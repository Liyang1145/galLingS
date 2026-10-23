//! Explicit Windows integration trial. No Python, legacy protocol or interpreter fallback.
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn publish(window: &WebviewWindow) {
    let paused = !window.is_focused().unwrap_or(false)
        || window.is_minimized().unwrap_or(true);
    let sequence = SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1;
    let script = format!(
        "window.__HAIFENG_HOST__?.receive({{format:'haifeng.host-state/1',platform:'windows-trial',sequence:{sequence},paused:{paused}});"
    );
    if let Err(error) = window.eval(script) {
        eprintln!("窗口状态未能送达游戏页面：{error}");
    }
}

pub fn run() {
    if !cfg!(target_os = "windows") {
        panic!("rebuild-host 当前仅用于 Windows 集成试用");
    }
    let context = tauri::generate_context!();
    // A feature flag alone must never start the legacy placeholder/resources.
    assert_eq!(
        context.config().identifier,
        "com.gallings.haifeng.rebuild",
        "请先显式准备游戏包，并通过生成的重构配置启用宿主"
    );
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Focused(_) | WindowEvent::Resized(_)) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    publish(&webview);
                }
            }
        })
        .setup(|app| {
            let data = app.path().app_local_data_dir()?.join("webview");
            std::fs::create_dir_all(&data)?;
            WebviewWindowBuilder::new(app, "rebuild", WebviewUrl::App("index.html".into()))
                .title("海风与布丁 · 重构集成试用")
                .inner_size(1440.0, 810.0)
                .min_inner_size(960.0, 540.0)
                .center()
                .use_https_scheme(true)
                .data_directory(data)
                .initialization_script(
                    include_str!("../../../packages/player/src/web/host-bootstrap.js")
                        .replace("__HAIFENG_PLATFORM__", "windows-trial"),
                )
                .on_navigation(|url| {
                    url.scheme() == "https"
                        && url.host_str() == Some("tauri.localhost")
                        && url.port().is_none()
                        && url.username().is_empty()
                        && url.password().is_none()
                        && matches!(url.path(), "/" | "/index.html")
                        && url.query().is_none()
                        && url.fragment().is_none()
                })
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .on_page_load(|window, payload| {
                    if matches!(payload.event(), PageLoadEvent::Finished) {
                        publish(&window);
                    }
                })
                .build()?;
            Ok(())
        })
        .run(context)
        .expect("重构集成宿主启动失败；未切换旧入口");
}
