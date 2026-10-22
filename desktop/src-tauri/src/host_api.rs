//! 宿主桥接口（/__host/info、/__host/window、/__host/saves、/__host/llm、/__host/tool）与原子文件存档。
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};
use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{AppHandle, Manager};

use crate::backend::stop_python_server;
use crate::tools::handle_tool;

const SAVE_KINDS: &[&str] = &["slots", "global", "prefs", "read", "plugins"];

pub fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(|p| p.to_path_buf())
}

pub fn resolve_game_root(app: &AppHandle) -> PathBuf {
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

pub fn save_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("saves");
    let _ = fs::create_dir_all(&d);
    d
}

pub fn config_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("config");
    let _ = fs::create_dir_all(&d);
    d
}

pub fn workspace_dir(app: &AppHandle) -> PathBuf {
    let d = app_base_dir(app).join("workspace");
    let _ = fs::create_dir_all(&d);
    d
}

pub fn json_resp(code: StatusCode, val: Value) -> Response<Vec<u8>> {
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

pub fn handle_host(app: &AppHandle, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
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
                    stop_python_server();
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
            if let Some(obj) = body.as_object() {
                let mut wrote_any = false;
                for &k in SAVE_KINDS {
                    if let Some(v) = obj.get(k) {
                        if let Err(e) = atomic_write_json(&sdir, k, v) {
                            return json_resp(StatusCode::INTERNAL_SERVER_ERROR, json!({ "ok": false, "error": e }));
                        }
                        wrote_any = true;
                    }
                }
                if wrote_any {
                    return json_resp(StatusCode::OK, json!({ "ok": true, "save_dir": sdir.to_string_lossy() }));
                }
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
            let provider = saved
                .get("provider")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("openai-compat")
                .to_string();
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
            let mode = saved
                .get("mode")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("choice")
                .to_string();
            let memory_use = saved
                .get("memory_use")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("lingshu")
                .to_string();
            let tail: String = api_key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
            return json_resp(
                StatusCode::OK,
                json!({
                    "ok": true,
                    "provider": provider,
                    "base_url": base_url,
                    "model": model,
                    "api_key": api_key,
                    "has_key": !api_key.is_empty(),
                    "key_set": !api_key.is_empty(),
                    "key_tail": tail,
                    "mode": mode,
                    "memory_use": memory_use
                }),
            );
        }
        if req.method() == Method::POST {
            let body: Value = serde_json::from_slice(req.body()).unwrap_or_else(|_| json!({}));
            let provider = body
                .get("provider")
                .and_then(|v| v.as_str())
                .or_else(|| saved.get("provider").and_then(|v| v.as_str()))
                .unwrap_or("openai-compat")
                .trim()
                .to_string();
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
            let mode = body
                .get("mode")
                .and_then(|v| v.as_str())
                .or_else(|| saved.get("mode").and_then(|v| v.as_str()))
                .unwrap_or("choice")
                .trim()
                .to_string();
            let memory_use = body
                .get("memory_use")
                .and_then(|v| v.as_str())
                .or_else(|| saved.get("memory_use").and_then(|v| v.as_str()))
                .unwrap_or("lingshu")
                .trim()
                .to_string();
            let given_key = body.get("api_key").and_then(|v| v.as_str()).map(|s| s.trim());
            let api_key = match given_key {
                Some("__clear__") | Some("") if body.get("clear_key").and_then(|v| v.as_bool()) == Some(true) => String::new(),
                Some(k) if !k.is_empty() => k.to_string(),
                _ => saved.get("api_key").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };
            let new_cfg = json!({
                "provider": provider,
                "base_url": base_url,
                "model": model,
                "api_key": api_key,
                "mode": mode,
                "memory_use": memory_use
            });
            if let Err(e) = atomic_write_json(&cdir, "llm", &new_cfg) {
                return json_resp(StatusCode::INTERNAL_SERVER_ERROR, json!({ "ok": false, "error": e }));
            }
            let tail: String = api_key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
            return json_resp(
                StatusCode::OK,
                json!({
                    "ok": true,
                    "provider": provider,
                    "base_url": base_url,
                    "model": model,
                    "api_key": api_key,
                    "has_key": !api_key.is_empty(),
                    "key_set": !api_key.is_empty(),
                    "key_tail": tail,
                    "mode": mode,
                    "memory_use": memory_use
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
