//! galLingS 桌面程序（Windows 优先）：一个窗口 + 两种模式。
//!
//! **完整模式**（tools/build_windows_app.py 打的免安装版）：exe 旁边有 `python\python.exe` 和 `galLingS\server`。
//! 启动时在后台（无控制台窗口）跑 `python -m server`，等它起来后窗口直接打开 `http://127.0.0.1:<端口>/vn.html`，
//! 和双击 start.bat 用浏览器玩完全一样：AI 模式、结局后聊天（GalAgent）、灵枢记忆、插件全都在。
//! 后端进程放进 Job Object，关窗口 / 程序崩溃时一起结束。后端输出写到 `logs\server.log`。
//!
//! **离线模式**（tools/build_desktop_dist.py 的离线包作为资源装在 `game/` 下）：网页通过 `app://localhost/…`
//! （Windows 上 WebView2 显示为 `http://app.localhost/…`）读取，路径和 galLingS 服务端路由一致，
//! 引擎是 static/offline/galcore.wasm，在页面里跑，没有后台进程，只有纯选项模式。
//! 音乐要能拖动 / 循环，所以协议支持 Range。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::http::{header, Request, Response, StatusCode};
use tauri::webview::NewWindowResponse;
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

fn mime(p: &Path) -> &'static str {
    match p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("wasm") => "application/wasm",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("mp3") => "audio/mpeg",
        Some("ogg") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("m4a") => "audio/mp4",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("ico") => "image/x-icon",
        // api/vn/games 这类没有扩展名的静态接口
        None => "application/json",
        _ => "application/octet-stream",
    }
}

/// URL 路径 → 资源目录里的文件；拒绝 `..`、盘符等越界路径
fn resolve(root: &Path, url_path: &str) -> Option<PathBuf> {
    let decoded = percent_encoding::percent_decode_str(url_path).decode_utf8().ok()?;
    let rel = decoded.trim_start_matches('/');
    let rel = if rel.is_empty() { "vn.html" } else { rel };
    let mut out = root.to_path_buf();
    for c in Path::new(rel).components() {
        match c {
            Component::Normal(s) => out.push(s),
            Component::CurDir => {}
            _ => return None,
        }
    }
    if out.is_dir() {
        out.push("index.html");
    }
    out.is_file().then_some(out)
}

fn respond(root: &Path, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let text = |code: StatusCode, msg: &str| {
        Response::builder()
            .status(code)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(msg.as_bytes().to_vec())
            .unwrap()
    };
    let Some(path) = resolve(root, req.uri().path()) else {
        return text(StatusCode::NOT_FOUND, "not found");
    };
    let Ok(mut f) = File::open(&path) else {
        return text(StatusCode::NOT_FOUND, "not found");
    };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let ty = mime(&path);
    // Range: bytes=a-b（音频拖动 / 循环）
    let range = req
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("bytes="))
        .and_then(|v| {
            let (a, b) = v.split_once('-')?;
            let (start, end) = if a.is_empty() {
                let n: u64 = b.parse().ok()?;
                (len.saturating_sub(n), len.saturating_sub(1))
            } else {
                let s: u64 = a.parse().ok()?;
                let e = if b.is_empty() { len.saturating_sub(1) } else { b.parse::<u64>().ok()?.min(len.saturating_sub(1)) };
                (s, e)
            };
            (start <= end && end < len).then_some((start, end))
        });
    let mut b = Response::builder()
        .header(header::CONTENT_TYPE, ty)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CACHE_CONTROL, "no-cache");
    let mut buf = Vec::new();
    match range {
        Some((s, e)) => {
            let n = (e - s + 1) as usize;
            buf.resize(n, 0);
            if f.seek(SeekFrom::Start(s)).and_then(|_| f.read_exact(&mut buf)).is_err() {
                return text(StatusCode::INTERNAL_SERVER_ERROR, "read error");
            }
            b = b
                .status(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_RANGE, format!("bytes {s}-{e}/{len}"));
        }
        None => {
            if f.read_to_end(&mut buf).is_err() {
                return text(StatusCode::INTERNAL_SERVER_ERROR, "read error");
            }
        }
    }
    b.body(buf).unwrap()
}

// ---------------------------------------------------------------- 完整模式：自带 Python + galLingS 后端

/// 启动时的等待页（后端起来前显示；起不来时把原因和日志末尾显示在这里）
const BOOT_HTML: &str = r#"<!doctype html><meta charset="utf-8"><title>正在启动</title>
<style>html,body{margin:0;height:100%;background:#10151c;color:#e9eef5;font:15px/1.6 "Microsoft YaHei UI","PingFang SC",sans-serif}
main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 8vw;box-sizing:border-box}
.dot{width:42px;height:42px;border-radius:50%;border:3px solid #ffffff22;border-top-color:#8fd3ff;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}small{color:#9aa7b5}pre{max-width:100%;max-height:45vh;overflow:auto;background:#0008;padding:10px 12px;border-radius:8px;font:12px/1.5 Consolas,monospace;white-space:pre-wrap;text-align:left}
.err .dot{display:none}h2{margin:0;font-weight:600}</style>
<main id="m"><div class="dot"></div><h2 id="t">正在启动 galLingS…</h2><small id="s">第一次打开要多等几秒</small><pre id="log" hidden></pre></main>
<script>window.__bootFail=function(t,s,log){document.getElementById('m').className='err';document.getElementById('t').textContent=t;document.getElementById('s').textContent=s;var p=document.getElementById('log');if(log){p.hidden=false;p.textContent=log;}}</script>"#;

struct Backend {
    child: Mutex<Option<Child>>,
}

impl Backend {
    fn stop(&self) {
        if let Some(mut c) = self.child.lock().unwrap().take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}

/// exe 所在文件夹（免安装版的根目录）
fn app_dir() -> PathBuf {
    std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)).unwrap_or_else(|| PathBuf::from("."))
}

/// 完整模式要的两样东西都在：python\python.exe 和 galLingS\server\__main__.py
fn full_layout(dir: &Path) -> Option<(PathBuf, PathBuf)> {
    let py = dir.join("python").join("python.exe");
    let gl = dir.join("galLingS");
    (py.is_file() && gl.join("server").join("__main__.py").is_file()).then_some((py, gl))
}

/// 优先用固定端口（网页把模型设置存在 localStorage，按端口分开存；端口变了设置就“丢了”）
fn pick_port() -> u16 {
    for p in 8765..=8775 {
        if TcpListener::bind(("127.0.0.1", p)).is_ok() {
            return p;
        }
    }
    TcpListener::bind(("127.0.0.1", 0)).and_then(|l| l.local_addr()).map(|a| a.port()).unwrap_or(8765)
}

/// GET /api/status 回 200 就算起来了
fn backend_ready(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut s) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) else { return false };
    let _ = s.set_read_timeout(Some(Duration::from_secs(3)));
    if s.write_all(b"GET /api/status HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n").is_err() {
        return false;
    }
    let mut buf = [0u8; 16];
    matches!(s.read(&mut buf), Ok(n) if n >= 12 && &buf[9..12] == b"200")
}

fn log_tail(p: &Path) -> String {
    let s = std::fs::read(p).map(|b| String::from_utf8_lossy(&b).into_owned()).unwrap_or_default();
    let lines: Vec<&str> = s.lines().collect();
    lines[lines.len().saturating_sub(30)..].join("\n")
}

fn js_str(s: &str) -> String {
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => {}
            '<' => o.push_str("\\u003c"),
            c if (c as u32) < 0x20 => {}
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

/// 后端进程放进“关句柄即结束”的 Job：程序被强关、崩溃时也不会留下孤儿进程占着端口
#[cfg(windows)]
fn bind_to_job(child: &Child) {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::JobObjects::*;
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            return;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        AssignProcessToJobObject(job, child.as_raw_handle() as _);
        // 故意不关 job 句柄：进程退出时系统关掉它，后端随之结束
    }
}
#[cfg(not(windows))]
fn bind_to_job(_: &Child) {}

fn spawn_backend(py: &Path, gl: &Path, port: u16, log: &Path) -> std::io::Result<Child> {
    let _ = std::fs::create_dir_all(log.parent().unwrap());
    let out = File::create(log)?;
    let err = out.try_clone()?;
    let mut cmd = Command::new(py);
    cmd.args(["-X", "utf8", "-u", "-m", "server", "--no-browser", "--port", &port.to_string()])
        .current_dir(gl)
        .env("PYTHONIOENCODING", "utf-8")
        .env("GALLINGS_DESKTOP", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(out))
        .stderr(Stdio::from(err));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd.spawn()?;
    bind_to_job(&child);
    Ok(child)
}

/// 网页里 target=_blank 的链接（申请密钥、接口文档…）交给系统浏览器
fn open_external(url: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).creation_flags(0x0800_0000).spawn();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("xdg-open").arg(url).spawn();
    }
}

fn app_url(path: &str) -> String {
    #[cfg(windows)]
    return format!("http://app.localhost/{path}");
    #[cfg(not(windows))]
    return format!("app://localhost/{path}");
}

fn main() {
    let dir = app_dir();
    let full = full_layout(&dir);
    let title = std::env::current_exe()
        .ok()
        .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .filter(|s| !s.is_empty() && s != "gallings-desktop")
        .unwrap_or_else(|| "海风与布丁".into());

    let app = tauri::Builder::default()
        .manage(Backend { child: Mutex::new(None) })
        .register_uri_scheme_protocol("app", |ctx, req| {
            if req.uri().path() == "/__boot.html" {
                return Response::builder()
                    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                    .body(BOOT_HTML.as_bytes().to_vec())
                    .unwrap();
            }
            let root = ctx
                .app_handle()
                .path()
                .resource_dir()
                .map(|d| d.join("game"))
                .unwrap_or_else(|_| PathBuf::from("game"));
            // 开发时（cargo run）资源还没装：退回仓库里的 dist/desktop
            let root = if root.is_dir() { root } else { PathBuf::from("../../dist/desktop") };
            respond(&root, &req)
        })
        .setup(move |app| {
            let start = if full.is_some() { app_url("__boot.html") } else { app_url("vn.html") };
            let nav_handle = app.handle().clone();
            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start.parse().unwrap()))
                .title(&title)
                .inner_size(1600.0, 900.0)
                .min_inner_size(960.0, 540.0)
                .center()
                .on_navigation(move |url| {
                    // 纯游戏模式按 F11 / Alt+Enter 会跳到这个地址：拦下来，切换整个窗口的全屏
                    if url.path() == "/__gl/fullscreen" {
                        if let Some(w) = nav_handle.get_webview_window("main") {
                            let on = w.is_fullscreen().unwrap_or(false);
                            let _ = w.set_fullscreen(!on);
                        }
                        return false;
                    }
                    true
                })
                .on_new_window(|url, _| {
                    open_external(url.as_str());
                    NewWindowResponse::Deny
                })
                .build()?;
            if let Some((py, gl)) = full.clone() {
                let port = pick_port();
                let log = dir.join("logs").join("server.log");
                match spawn_backend(&py, &gl, port, &log) {
                    Ok(child) => {
                        *app.state::<Backend>().child.lock().unwrap() = Some(child);
                        let handle = app.handle().clone();
                        std::thread::spawn(move || {
                            let t0 = Instant::now();
                            loop {
                                if backend_ready(port) {
                                    let url = format!("http://127.0.0.1:{port}/vn.html?play=desktop");
                                    let _ = win.navigate(url.parse().unwrap());
                                    return;
                                }
                                let exited = handle
                                    .state::<Backend>()
                                    .child
                                    .lock()
                                    .unwrap()
                                    .as_mut()
                                    .map(|c| matches!(c.try_wait(), Ok(Some(_))))
                                    .unwrap_or(true);
                                if exited || t0.elapsed() > Duration::from_secs(90) {
                                    let why = if exited { "galLingS 后端启动失败" } else { "galLingS 后端 90 秒还没起来" };
                                    let hint = format!("日志在 {}；也可以双击“调试-用控制台启动后端.bat”看完整报错", log.display());
                                    let _ = win.eval(format!(
                                        "window.__bootFail&&__bootFail({},{},{})",
                                        js_str(why),
                                        js_str(&hint),
                                        js_str(&log_tail(&log))
                                    ));
                                    return;
                                }
                                std::thread::sleep(Duration::from_millis(250));
                            }
                        });
                    }
                    Err(e) => {
                        let msg = format!("没能运行 {}：{e}", py.display());
                        let w = win.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(800));
                            let _ = w.eval(format!("window.__bootFail&&__bootFail({},{},'')", js_str("galLingS 后端启动失败"), js_str(&msg)));
                        });
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("galLingS 桌面程序启动失败");
    app.run(|h, ev| {
        if let RunEvent::Exit = ev {
            h.state::<Backend>().stop();
        }
    });
}
