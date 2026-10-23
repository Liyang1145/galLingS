//! Explicit Windows integration trial. No Python, legacy protocol or interpreter fallback.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);
static ACKNOWLEDGED: AtomicU64 = AtomicU64::new(0);
static DELIVERY_WARNED: AtomicBool = AtomicBool::new(false);
static STOP_HEARTBEAT: AtomicBool = AtomicBool::new(false);

fn warn_delivery() {
    if !DELIVERY_WARNED.swap(true, Ordering::SeqCst) {
        eprintln!("游戏页尚未确认窗口状态，宿主将周期重试；页面超时后保持暂停");
    }
}

fn publish(window: &WebviewWindow) {
    let paused = !window.is_focused().unwrap_or(false)
        || window.is_minimized().unwrap_or(true);
    let sequence = SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1;
    let script = format!(
        "(() => {{const b=window.__HAIFENG_HOST__; if(b?.protocol!=='haifeng.host-bridge/2') return null; b.receive({{format:'haifeng.host-state/1',platform:'windows-trial',sequence:{sequence},paused:{paused}}); return b.read().sequence;}})()"
    );
    if sequence.saturating_sub(ACKNOWLEDGED.load(Ordering::SeqCst)) > 4 {
        warn_delivery();
    }
    if window.eval_with_callback(script, move |answer| {
        if let Ok(ack) = serde_json::from_str::<u64>(&answer) {
            if ack >= sequence && ack <= SEQUENCE.load(Ordering::SeqCst) {
                ACKNOWLEDGED.fetch_max(ack, Ordering::SeqCst);
                DELIVERY_WARNED.store(false, Ordering::SeqCst);
                return;
            }
        }
        warn_delivery();
    }).is_err() {
        warn_delivery();
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
            if window.label() == "rebuild" && matches!(event, WindowEvent::Destroyed) {
                STOP_HEARTBEAT.store(true, Ordering::SeqCst);
            }
            if matches!(event, WindowEvent::Focused(_) | WindowEvent::Resized(_)) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    publish(&webview);
                }
            }
        })
        .setup(|app| {
            let asset = app.asset_resolver().get("game-package.json".into())
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "缺少游戏包清单，请重新准备"))?;
            let manifest: serde_json::Value = serde_json::from_slice(&asset.bytes)?;
            if manifest["format"] != "haifeng.game-package/2" || manifest["hostBridge"] != "haifeng.host-bridge/2" {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "游戏包与宿主协议不匹配，请重新构建并准备").into());
            }
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
            let handle = app.handle().clone();
            std::thread::Builder::new().name("haifeng-host-state".into()).spawn(move || {
                while !STOP_HEARTBEAT.load(Ordering::SeqCst) {
                    if let Some(window) = handle.get_webview_window("rebuild") {
                        publish(&window);
                    } else {
                        break;
                    }
                    std::thread::sleep(Duration::from_secs(1));
                }
            })?;
            Ok(())
        })
        .run(context)
        .expect("重构集成宿主启动失败；未切换旧入口");
}
