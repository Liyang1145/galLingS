//! galLingS 桌面程序（Steam 发行版 & Windows / Linux 独立客户端）：
//! - `backend`：Python `galLingS` 完整引擎进程探测、启动与生命周期管理
//! - `host_api`：`/__host/*` 窗口控制、Steam Auto-Cloud 原子存档、独立大模型配置
//! - `tools`：GalAgent 结局后自由聊天工作区工具执行器
//! - `main`：`app://` 自定义协议静态资源 / Range 响应与主窗口初始化
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod host_api;
mod tools;

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::backend::{ensure_python_backend, stop_python_server};
use crate::host_api::{handle_host, resolve_game_root};

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

/// Linux（WebKitGTK）上的已知坑：部分 NVIDIA / 虚拟机 / Wayland 环境下 DMA-BUF 渲染会白屏或黑屏。
/// 用户自己设置过就尊重用户的设置；`GALLINGS_WEBKIT_DMABUF=1` 可以显式打开。
#[cfg(target_os = "linux")]
fn linux_webkit_env() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
        && std::env::var("GALLINGS_WEBKIT_DMABUF").as_deref() != Ok("1")
    {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    linux_webkit_env();
    tauri::Builder::default()
        .register_uri_scheme_protocol("app", |ctx, req| {
            let app = ctx.app_handle();
            let root = resolve_game_root(app);
            respond(app, &root, &req)
        })
        .on_window_event(|_win, ev| {
            if matches!(ev, WindowEvent::Destroyed) {
                stop_python_server();
            }
        })
        .setup(|app| {
            #[cfg(windows)]
            let fallback_url = "http://app.localhost/vn.html?steam=1".to_string();
            #[cfg(not(windows))]
            let fallback_url = "app://localhost/vn.html?steam=1".to_string();

            let url = ensure_python_backend(app.handle()).unwrap_or(fallback_url);
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
    stop_python_server();
}
