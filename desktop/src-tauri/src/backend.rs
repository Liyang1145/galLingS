//! Python 完整引擎后台进程管理：探测、启动、/health 轮询与退出清理。
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::AppHandle;

use crate::host_api::{config_dir, exe_dir, save_dir, workspace_dir};

static PYTHON_SERVER: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn server_slot() -> &'static Mutex<Option<Child>> {
    PYTHON_SERVER.get_or_init(|| Mutex::new(None))
}

pub fn stop_python_server() {
    if let Ok(mut guard) = server_slot().lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

pub fn check_server_health(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(180)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(250)));
    let req = format!("GET /health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let mut buf = [0u8; 512];
    let Ok(n) = stream.read(&mut buf) else {
        return false;
    };
    let text = String::from_utf8_lossy(&buf[..n]);
    text.starts_with("HTTP/1.1 200") && (text.contains("\"status\"") || text.contains("\"ok\""))
}

fn pick_available_port(preferred: u16) -> u16 {
    if TcpListener::bind(("127.0.0.1", preferred)).is_ok() {
        return preferred;
    }
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(preferred)
}

fn resolve_backend_root() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(custom) = std::env::var("GALLINGS_ROOT") {
        candidates.push(PathBuf::from(custom));
    }
    if let Some(ed) = exe_dir() {
        candidates.push(ed.clone());
        if let Some(p1) = ed.parent() {
            candidates.push(p1.to_path_buf());
            if let Some(p2) = p1.parent() {
                candidates.push(p2.to_path_buf());
                if let Some(p3) = p2.parent() {
                    candidates.push(p3.to_path_buf());
                }
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.clone());
        if let Some(p1) = cwd.parent() {
            candidates.push(p1.to_path_buf());
            if let Some(p2) = p1.parent() {
                candidates.push(p2.to_path_buf());
            }
        }
    }
    for c in candidates {
        if c.join("server").join("__main__.py").is_file() && c.join("plugins").join("builtin").is_dir() {
            return Some(c);
        }
    }
    None
}

fn find_python_executable(backend_root: &Path) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("GALLINGS_PYTHON") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    let mut search_roots = vec![backend_root.to_path_buf()];
    if let Some(ed) = exe_dir() {
        search_roots.push(ed);
    }
    let mut cur = Some(backend_root);
    while let Some(d) = cur {
        search_roots.push(d.to_path_buf());
        cur = d.parent();
    }
    for r in search_roots {
        #[cfg(windows)]
        let rels = [
            "python/python.exe",
            ".venv/Scripts/python.exe",
            "venv/Scripts/python.exe",
        ];
        #[cfg(not(windows))]
        let rels = [
            "python/bin/python3",
            ".venv/bin/python",
            "venv/bin/python",
        ];
        for rel in rels {
            let cand = r.join(rel);
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    for bin in ["python", "python3"] {
        let mut cmd = Command::new(bin);
        cmd.args(["-c", "import fastapi, uvicorn, galcore; print('ok')"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(PathBuf::from(bin));
            }
        }
    }
    None
}

pub fn ensure_python_backend(app: &AppHandle) -> Option<String> {
    if std::env::var("GALLINGS_FORCE_OFFLINE").as_deref() == Ok("1") {
        return None;
    }
    let preferred_port: u16 = std::env::var("GALLINGS_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8765);

    if check_server_health(preferred_port) {
        return Some(format!("http://127.0.0.1:{preferred_port}/vn.html?steam=1"));
    }

    let backend_root = resolve_backend_root()?;
    let py = find_python_executable(&backend_root)?;
    let port = pick_available_port(preferred_port);

    let sdir = save_dir(app);
    let cdir = config_dir(app);
    let wdir = workspace_dir(app);

    let mut cmd = Command::new(&py);
    cmd.args([
        "-m",
        "server",
        "--no-browser",
        "--host",
        "127.0.0.1",
        "--port",
        &port.to_string(),
    ])
    .current_dir(&backend_root)
    .env("GALLINGS_SAVE_DIR", &sdir)
    .env("GALLINGS_CONFIG_DIR", &cdir)
    .env("GALLINGS_WORKSPACE_DIR", &wdir)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

    // 若在 Steam 打包目录下运行（游戏本体位于 game/vn），自动关联作品目录与插件目录
    let bundled_vn = backend_root.join("game").join("vn");
    if bundled_vn.is_dir() && !backend_root.join("海风与布丁").is_dir() {
        cmd.env("GALLINGS_GAMES_DIR", &bundled_vn);
    }
    let bundled_plugs = backend_root.join("game").join("vn_plugins");
    if bundled_plugs.is_dir() && !backend_root.join("content").join("vn_plugins").is_dir() {
        cmd.env("GALLINGS_VN_PLUGINS_DIR", &bundled_plugs);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let child = cmd.spawn().ok()?;
    if let Ok(mut guard) = server_slot().lock() {
        *guard = Some(child);
    }

    let deadline = Instant::now() + Duration::from_millis(5500);
    while Instant::now() < deadline {
        if check_server_health(port) {
            return Some(format!("http://127.0.0.1:{port}/vn.html?steam=1"));
        }
        std::thread::sleep(Duration::from_millis(80));
    }

    stop_python_server();
    None
}
