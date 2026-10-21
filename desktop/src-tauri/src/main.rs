//! galLingS 桌面程序（Steam 发行版 & Windows 独立客户端）：
//! - 纯净游戏模式启动（?steam=1，直达《海风与布丁》标题画面，隐藏调试顶栏，支持 F11/设置全屏与退出游戏）
//! - 本地文件存档（%APPDATA%/com.gallings.haifeng/saves/*.json 或便携模式 saves/，原子写入，支持 Steam Auto-Cloud 云存档）
//! - 独立本机大模型配置（%APPDATA%/com.gallings.haifeng/config/llm.json，与存档目录隔离，避免云存档同步泄露 API Key）
//! - 原生 GalAgent 工具桥（/__host/tool：get_time / list_dir / read_file / write_file / powershell，限定在 workspace 目录）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const SAVE_KINDS: &[&str] = &["slots", "global", "prefs", "read", "plugins"];

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

fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(|p| p.to_path_buf())
}

fn resolve_game_root(app: &AppHandle) -> PathBuf {
    if let Some(ed) = exe_dir() {
        let portable = ed.join("game");
        if portable.is_dir() {
            return portable;
        }
    }
    if let Ok(rd) = app.path().resource_dir() {
        let bundled = rd.join("game");
        if bundled.is_dir() {
            return bundled;
        }
    }
    let cwd_game = PathBuf::from("game");
    if cwd_game.is_dir() {
        return cwd_game;
    }
    let dev_dist = PathBuf::from("../../dist/desktop");
    if dev_dist.is_dir() {
        return dev_dist;
    }
    PathBuf::from("dist/desktop")
}

fn app_base_dir(app: &AppHandle) -> PathBuf {
    if let Some(ed) = exe_dir() {
        if ed.join("portable.txt").is_file()
            || ed.join("userdata").is_dir()
            || std::env::var("GALLINGS_PORTABLE_SAVES").as_deref() == Ok("1")
        {
            return ed.join("userdata");
        }
    }
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| exe_dir().unwrap_or_else(|| PathBuf::from(".")).join("userdata"))
}

fn save_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("saves");
    let _ = fs::create_dir_all(&d);
    d
}

fn config_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("config");
    let _ = fs::create_dir_all(&d);
    d
}

fn workspace_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("workspace");
    let _ = fs::create_dir_all(&d);
    d
}

fn json_resp(code: StatusCode, val: Value) -> Response<Vec<u8>> {
    let body = serde_json::to_vec(&val).unwrap_or_else(|_| b"{}".to_vec());
    Response::builder()
        .status(code)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        .body(body)
        .unwrap()
}

fn atomic_write_json(dir: &Path, name: &str, val: &Value) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let target = dir.join(format!("{name}.json"));
    let tmp = dir.join(format!("{name}.json.tmp"));
    let bytes = serde_json::to_vec_pretty(val).map_err(|e| e.to_string())?;
    {
        let mut f = File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        let _ = f.sync_all();
    }
    fs::rename(&tmp, &target).map_err(|e| e.to_string())
}

fn read_json_file(path: &Path) -> Option<Value> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn safe_workspace_path(ws: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim();
    let rel = if rel.is_empty() { "." } else { rel };
    let p = Path::new(rel);
    if p.is_absolute() {
        return Err("只允许访问工作目录内的相对路径".into());
    }
    let mut out = ws.to_path_buf();
    for c in p.components() {
        match c {
            Component::Normal(s) => out.push(s),
            Component::CurDir => {}
            _ => return Err("路径不能包含 .. 或越界前缀".into()),
        }
    }
    Ok(out)
}

fn truncate_str(s: &str, max_chars: usize) -> (String, bool) {
    let count = s.chars().count();
    if count <= max_chars {
        return (s.to_string(), false);
    }
    let head_n = max_chars * 2 / 3;
    let tail_n = max_chars / 3;
    let head: String = s.chars().take(head_n).collect();
    let tail: String = s.chars().skip(count.saturating_sub(tail_n)).collect();
    (format!("{head}\n…（中间省略 {} 字）…\n{tail}", count - head_n - tail_n), true)
}

fn handle_tool(app: &AppHandle, body: &Value) -> Response<Vec<u8>> {
    let ws = workspace_dir(app);
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let args = body.get("args").cloned().unwrap_or_else(|| json!({}));
    match name {
        "get_time" => {
            let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
            json_resp(StatusCode::OK, json!({
                "ok": true,
                "result": { "unix_seconds": secs, "workspace": ws.to_string_lossy() }
            }))
        }
        "list_dir" => {
            let rel = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
            let target = match safe_workspace_path(&ws, rel) {
                Ok(p) => p,
                Err(e) => return json_resp(StatusCode::OK, json!({ "ok": false, "error": e })),
            };
            let rd = match fs::read_dir(&target) {
                Ok(r) => r,
                Err(e) => return json_resp(StatusCode::OK, json!({ "ok": false, "error": e.to_string() })),
            };
            let mut entries = Vec::new();
            for entry in rd.flatten().take(300) {
                let fname = entry.file_name().to_string_lossy().to_string();
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() {
                        entries.push(format!("{fname}/"));
                    } else {
                        entries.push(format!("{fname}  ({} B)", meta.len()));
                    }
                }
            }
            entries.sort();
            json_resp(StatusCode::OK, json!({
                "ok": true,
                "result": { "path": target.to_string_lossy(), "count": entries.len(), "entries": entries }
            }))
        }
        "read_file" => {
            let Some(rel) = args.get("path").and_then(|v| v.as_str()) else {
                return json_resp(StatusCode::OK, json!({ "ok": false, "error": "缺少 path" }));
            };
            let target = match safe_workspace_path(&ws, rel) {
                Ok(p) => p,
                Err(e) => return json_resp(StatusCode::OK, json!({ "ok": false, "error": e })),
            };
            let text = match fs::read_to_string(&target) {
                Ok(t) => t,
                Err(e) => return json_resp(StatusCode::OK, json!({ "ok": false, "error": e.to_string() })),
            };
            let max_c = args.get("max_chars").and_then(|v| v.as_u64()).unwrap_or(8000) as usize;
            let (body_txt, truncated) = truncate_str(&text, max_c.clamp(100, 100_000));
            json_resp(StatusCode::OK, json!({
                "ok": true,
                "result": { "path": target.to_string_lossy(), "chars": text.chars().count(), "truncated": truncated, "text": body_txt }
            }))
        }
        "write_file" => {
            let Some(rel) = args.get("path").and_then(|v| v.as_str()) else {
                return json_resp(StatusCode::OK, json!({ "ok": false, "error": "缺少 path" }));
            };
            let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let append = args.get("append").and_then(|v| v.as_bool()).unwrap_or(false);
            let target = match safe_workspace_path(&ws, rel) {
                Ok(p) => p,
                Err(e) => return json_resp(StatusCode::OK, json!({ "ok": false, "error": e })),
            };
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let res = if append {
                fs::OpenOptions::new().create(true).append(true).open(&target).and_then(|mut f| f.write_all(content.as_bytes()))
            } else {
                fs::write(&target, content.as_bytes())
            };
            match res {
                Ok(()) => {
                    let bytes = fs::metadata(&target).map(|m| m.len()).unwrap_or(content.len() as u64);
                    json_resp(StatusCode::OK, json!({
                        "ok": true,
                        "result": { "path": target.to_string_lossy(), "bytes": bytes, "mode": if append { "a" } else { "w" } }
                    }))
                }
                Err(e) => json_resp(StatusCode::OK, json!({ "ok": false, "error": e.to_string() })),
            }
        }
        "powershell" => {
            let Some(cmd_str) = args.get("command").and_then(|v| v.as_str()) else {
                return json_resp(StatusCode::OK, json!({ "ok": false, "error": "缺少 command" }));
            };
            let t0 = Instant::now();
            #[cfg(windows)]
            let output = {
                use std::os::windows::process::CommandExt;
                let full_cmd = format!(
                    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;{cmd_str}"
                );
                Command::new("powershell.exe")
                    .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", &full_cmd])
                    .current_dir(&ws)
                    .creation_flags(0x08000000)
                    .output()
            };
            #[cfg(not(windows))]
            let output = Command::new("sh").args(["-lc", cmd_str]).current_dir(&ws).output();

            match output {
                Ok(out) => {
                    let code = out.status.code().unwrap_or(-1);
                    let (so, t1) = truncate_str(&String::from_utf8_lossy(&out.stdout), 8000);
                    let (se, t2) = truncate_str(&String::from_utf8_lossy(&out.stderr), 4000);
                    json_resp(StatusCode::OK, json!({
                        "ok": code == 0,
                        "error": if code == 0 { Value::Null } else { json!(format!("退出码 {code}")) },
                        "result": {
                            "shell": if cfg!(windows) { "powershell" } else { "sh" },
                            "exit_code": code,
                            "stdout": so,
                            "stderr": se,
                            "truncated": t1 || t2,
                            "elapsed_ms": t0.elapsed().as_millis() as u64
                        }
                    }))
                }
                Err(e) => json_resp(StatusCode::OK, json!({ "ok": false, "error": e.to_string() })),
            }
        }
        _ => json_resp(StatusCode::OK, json!({ "ok": false, "error": format!("未知工具：{name}") })),
    }
}

fn handle_host(app: &AppHandle, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    if req.method() == Method::OPTIONS {
        return json_resp(StatusCode::NO_CONTENT, json!({}));
    }
    let path = req.uri().path();
    let sdir = save_dir(app);
    let cdir = config_dir(app);
    let wdir = workspace_dir(app);

    if path == "/__host/info" && req.method() == Method::GET {
        let fullscreen = app
            .get_webview_window("main")
            .and_then(|w| w.is_fullscreen().ok())
            .unwrap_or(false);
        return json_resp(
            StatusCode::OK,
            json!({
                "ok": true,
                "steam": true,
                "platform": std::env::consts::OS,
                "fullscreen": fullscreen,
                "save_dir": sdir.to_string_lossy(),
                "config_dir": cdir.to_string_lossy(),
                "workspace_dir": wdir.to_string_lossy()
            }),
        );
    }

    if path == "/__host/window" && req.method() == Method::POST {
        let body: Value = serde_json::from_slice(req.body()).unwrap_or_else(|_| json!({}));
        let action = body.get("action").and_then(|v| v.as_str()).unwrap_or("");
        match action {
            "toggle_fullscreen" | "set_fullscreen" => {
                if let Some(win) = app.get_webview_window("main") {
                    let cur = win.is_fullscreen().unwrap_or(false);
                    let target = if action == "set_fullscreen" {
                        body.get("fullscreen").and_then(|v| v.as_bool()).unwrap_or(!cur)
                    } else {
                        !cur
                    };
                    let _ = win.set_fullscreen(target);
                    let now = win.is_fullscreen().unwrap_or(target);
                    return json_resp(StatusCode::OK, json!({ "ok": true, "fullscreen": now }));
                }
                return json_resp(StatusCode::OK, json!({ "ok": false, "error": "找不到主窗口" }));
            }
            "quit" => {
                let handle = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(80));
                    handle.exit(0);
                });
                return json_resp(StatusCode::OK, json!({ "ok": true }));
            }
            "open_save_dir" => {
                #[cfg(windows)]
                let _ = Command::new("explorer.exe").arg(&sdir).spawn();
                #[cfg(target_os = "macos")]
                let _ = Command::new("open").arg(&sdir).spawn();
                #[cfg(all(unix, not(target_os = "macos")))]
                let _ = Command::new("xdg-open").arg(&sdir).spawn();
                return json_resp(StatusCode::OK, json!({ "ok": true, "save_dir": sdir.to_string_lossy() }));
            }
            _ => return json_resp(StatusCode::BAD_REQUEST, json!({ "ok": false, "error": "未知窗口动作" })),
        }
    }

    if path == "/__host/saves" {
        if req.method() == Method::GET {
            let mut data = serde_json::Map::new();
            for &k in SAVE_KINDS {
                let f = sdir.join(format!("{k}.json"));
                if let Some(v) = read_json_file(&f) {
                    data.insert(k.to_string(), v);
                }
            }
            return json_resp(
                StatusCode::OK,
                json!({
                    "ok": true,
                    "save_dir": sdir.to_string_lossy(),
                    "data": data
                }),
            );
        }
        if req.method() == Method::POST {
            let body: Value = serde_json::from_slice(req.body()).unwrap_or_else(|_| json!({}));
            if let Some(batch) = body.get("batch").and_then(|v| v.as_object()) {
                for (k, v) in batch {
                    if SAVE_KINDS.contains(&k.as_str()) {
                        if let Err(e) = atomic_write_json(&sdir, k, v) {
                            return json_resp(StatusCode::INTERNAL_SERVER_ERROR, json!({ "ok": false, "error": e }));
                        }
                    }
                }
                return json_resp(StatusCode::OK, json!({ "ok": true, "save_dir": sdir.to_string_lossy() }));
            }
            let kind = body.get("kind").and_then(|v| v.as_str()).unwrap_or("");
            if !SAVE_KINDS.contains(&kind) {
                return json_resp(StatusCode::BAD_REQUEST, json!({ "ok": false, "error": "不支持的存档类别" }));
            }
            let val = body.get("data").cloned().unwrap_or(Value::Null);
            match atomic_write_json(&sdir, kind, &val) {
                Ok(()) => return json_resp(StatusCode::OK, json!({ "ok": true, "kind": kind })),
                Err(e) => return json_resp(StatusCode::INTERNAL_SERVER_ERROR, json!({ "ok": false, "error": e })),
            }
        }
    }

    if path == "/__host/llm" {
        let llm_file = cdir.join("llm.json");
        let saved = read_json_file(&llm_file).unwrap_or_else(|| json!({}));
        if req.method() == Method::GET {
            let base_url = saved
                .get("base_url")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .or_else(|| std::env::var("GALLINGS_LLM_BASE_URL").ok())
                .unwrap_or_else(|| "https://api.deepseek.com".to_string());
            let model = saved
                .get("model")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .or_else(|| std::env::var("GALLINGS_LLM_MODEL").ok())
                .unwrap_or_else(|| "deepseek-chat".to_string());
            let api_key = saved
                .get("api_key")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .or_else(|| std::env::var("GALLINGS_LLM_API_KEY").ok())
                .unwrap_or_default();
            let tail: String = api_key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
            return json_resp(
                StatusCode::OK,
                json!({
                    "ok": true,
                    "base_url": base_url,
                    "model": model,
                    "api_key": api_key,
                    "key_set": !api_key.is_empty(),
                    "key_tail": tail
                }),
            );
        }
        if req.method() == Method::POST {
            let body: Value = serde_json::from_slice(req.body()).unwrap_or_else(|_| json!({}));
            let base_url = body
                .get("base_url")
                .and_then(|v| v.as_str())
                .or_else(|| saved.get("base_url").and_then(|v| v.as_str()))
                .unwrap_or("https://api.deepseek.com")
                .trim()
                .to_string();
            let model = body
                .get("model")
                .and_then(|v| v.as_str())
                .or_else(|| saved.get("model").and_then(|v| v.as_str()))
                .unwrap_or("deepseek-chat")
                .trim()
                .to_string();
            let given_key = body.get("api_key").and_then(|v| v.as_str()).map(|s| s.trim());
            let api_key = match given_key {
                Some("__clear__") => String::new(),
                Some(k) if !k.is_empty() => k.to_string(),
                _ => saved.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };
            let new_cfg = json!({ "base_url": base_url, "model": model, "api_key": api_key });
            if let Err(e) = atomic_write_json(&cdir, "llm", &new_cfg) {
                return json_resp(StatusCode::INTERNAL_SERVER_ERROR, json!({ "ok": false, "error": e }));
            }
            let tail: String = api_key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
            return json_resp(
                StatusCode::OK,
                json!({
                    "ok": true,
                    "base_url": base_url,
                    "model": model,
                    "api_key": api_key,
                    "key_set": !api_key.is_empty(),
                    "key_tail": tail
                }),
            );
        }
    }

    if path == "/__host/tool" && req.method() == Method::POST {
        let body: Value = serde_json::from_slice(req.body()).unwrap_or_else(|_| json!({}));
        return handle_tool(app, &body);
    }

    json_resp(StatusCode::NOT_FOUND, json!({ "ok": false, "error": "not found" }))
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

fn respond(app: &AppHandle, root: &Path, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    if req.uri().path().starts_with("/__host/") {
        return handle_host(app, req);
    }
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

fn main() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("app", |ctx, req| {
            let app = ctx.app_handle();
            let root = resolve_game_root(app);
            respond(app, &root, &req)
        })
        .setup(|app| {
            #[cfg(windows)]
            let url = "http://app.localhost/vn.html?steam=1";
            #[cfg(not(windows))]
            let url = "app://localhost/vn.html?steam=1";
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
                .title("海风与布丁")
                .inner_size(1440.0, 810.0)
                .min_inner_size(960.0, 540.0)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("galLingS 桌面程序启动失败");
}
