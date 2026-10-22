//! GalAgent 结局后自由聊天工作区工具执行器（离线模式下的本机工具桥）。
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::http::{Response, StatusCode};
use tauri::AppHandle;

use crate::host_api::{json_resp, workspace_dir};

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

pub fn handle_tool(app: &AppHandle, body: &Value) -> Response<Vec<u8>> {
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
