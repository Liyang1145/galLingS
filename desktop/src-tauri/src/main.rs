//! galLingS 桌面程序（Windows 优先）：一个窗口 + 一个本地协议。
//!
//! 离线包（tools/build_desktop_dist.py 的输出）作为资源装在 `game/` 下；网页通过 `app://localhost/…`
//! （Windows 上 WebView2 显示为 `http://app.localhost/…`）读取，路径和 galLingS 服务端路由一致，
//! 所以作品页、引擎桥、时间轴不用改。引擎是 static/offline/galcore.wasm，在页面里跑，没有后台进程。
//! 音乐要能拖动 / 循环，所以协议支持 Range。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};

use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

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

fn main() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("app", |ctx, req| {
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
        .setup(|app| {
            #[cfg(windows)]
            let url = "http://app.localhost/vn.html";
            #[cfg(not(windows))]
            let url = "app://localhost/vn.html";
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
                .title("海风与布丁")
                .inner_size(1440.0, 860.0)
                .min_inner_size(960.0, 600.0)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("galLingS 桌面程序启动失败");
}
