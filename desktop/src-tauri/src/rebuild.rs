//! Explicit Windows integration trial. No Python, legacy protocol or interpreter fallback.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
#[cfg(target_os = "windows")]
#[path = "rebuild_storage_bridge.rs"]
mod records_bridge;

static SEQUENCE: AtomicU64 = AtomicU64::new(0);
static ACKNOWLEDGED: AtomicU64 = AtomicU64::new(0);
static DELIVERY_WARNED: AtomicBool = AtomicBool::new(false);
static STOP_HEARTBEAT: AtomicBool = AtomicBool::new(false);
static EXIT_RUNNING: AtomicBool = AtomicBool::new(false);
static EXIT_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static PAGE_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static PAGE_READY: AtomicBool = AtomicBool::new(false);
static FULLSCREEN_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static FULLSCREEN: Mutex<FullscreenControl> = Mutex::new(FullscreenControl {
    page: 0, request: 0, owner: None, target: false, issue: None,
});

struct FullscreenControl {
    page: u64,
    request: u64,
    owner: Option<String>,
    target: bool,
    issue: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct FullscreenRequest {
    id: u64,
    active: bool,
    owner: String,
}

/// Optional display extension. The page cannot request files, navigation or story commands.
fn publish_fullscreen(window: &WebviewWindow) {
    if STOP_HEARTBEAT.load(Ordering::SeqCst) || !PAGE_READY.load(Ordering::SeqCst) { return; }
    let page = PAGE_SEQUENCE.load(Ordering::SeqCst);
    let active = match window.is_fullscreen() { Ok(value) => value, Err(_) => return };
    let (ack, request_owner, issue) = {
        let Ok(mut control) = FULLSCREEN.lock() else { return };
        if control.page != page {
            *control = FullscreenControl { page, request: 0, owner: None, target: active, issue: None };
        }
        let ack = if control.request > 0 && (control.target == active || control.issue.is_some()) {
            Some(control.request)
        } else { None };
        let request_owner = ack.and(control.owner.clone());
        (ack, request_owner, control.issue.clone())
    };
    let sequence = FULLSCREEN_SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1;
    let state = serde_json::json!({
        "format": "haifeng.fullscreen-state/1", "sequence": sequence,
        "active": active, "requestId": ack, "requestOwner": request_owner, "issue": issue,
    });
    let script = format!(
        "(() => {{const f=window.__HAIFENG_HOST__?.fullscreen; if(f?.protocol!=='haifeng.fullscreen/1') return null; f.receive({state});return f.readRequest();}})()"
    );
    let owner = window.clone();
    let started = Instant::now();
    let _ = window.eval_with_callback(script, move |answer| {
        if PAGE_SEQUENCE.load(Ordering::SeqCst) != page || STOP_HEARTBEAT.load(Ordering::SeqCst)
            || !PAGE_READY.load(Ordering::SeqCst) { return; }
        let Ok(Some(request)) = serde_json::from_str::<Option<FullscreenRequest>>(&answer) else { return };
        if request.id == 0 || request.id > 9_007_199_254_740_991
            || request.owner.len() != 36 || !request.owner.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-') { return; }
        let on_ui = owner.clone();
        let _ = owner.run_on_main_thread(move || {
            if PAGE_SEQUENCE.load(Ordering::SeqCst) != page || STOP_HEARTBEAT.load(Ordering::SeqCst)
                || !PAGE_READY.load(Ordering::SeqCst) || started.elapsed() > Duration::from_secs(2) { return; }
            {
                let Ok(mut control) = FULLSCREEN.lock() else { return };
                if control.page != page || request.id <= control.request { return; }
                control.request = request.id;
                control.owner = Some(request.owner);
                control.target = request.active;
                control.issue = None;
            }
            let error = on_ui.set_fullscreen(request.active).err()
                .map(|error| format!("窗口全屏请求失败：{error}").chars().take(512).collect::<String>());
            if let Ok(mut control) = FULLSCREEN.lock() {
                if control.page == page && control.request == request.id { control.issue = error; }
            }
            // A successful request is acknowledged only after the sampled window matches its target.
            publish_fullscreen(&on_ui);
        });
    });
}

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct ExitReply {
    id: u64,
    status: String,
}

fn request_exit(window: WebviewWindow) {
    if EXIT_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let id = EXIT_SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1;
    let page = PAGE_SEQUENCE.load(Ordering::SeqCst);
    if std::thread::Builder::new().name("haifeng-exit".into()).spawn(move || {
        let started = Instant::now();
        loop {
            if STOP_HEARTBEAT.load(Ordering::SeqCst) || PAGE_SEQUENCE.load(Ordering::SeqCst) != page {
                break;
            }
            if started.elapsed() > Duration::from_secs(30) {
                // A timeout never means storage succeeded and never authorizes forced close.
                eprintln!("退出等待超时，保留窗口；已发起的写入可能仍在进行");
                break;
            }
            let script = format!(
                "(() => {{const b=window.__HAIFENG_HOST__;return b?.protocol==='haifeng.host-bridge/3'?b.beginExit({id}):null;}})()"
            );
            let (sender, receiver) = mpsc::channel();
            if window.eval_with_callback(script, move |answer| { let _ = sender.send(answer); }).is_err() {
                eprintln!("退出请求未送达页面，保留窗口");
                break;
            }
            match receiver.recv_timeout(Duration::from_millis(400)) {
                Ok(answer) => {
                    match serde_json::from_str::<ExitReply>(&answer) {
                        Ok(reply) if reply.id == id => match reply.status.as_str() {
                            "ready" => {
                                if PAGE_SEQUENCE.load(Ordering::SeqCst) == page {
                                    // destroy bypasses a second CloseRequested event.
                                    if let Err(error) = window.destroy() {
                                        eprintln!("写入已完成但窗口未能关闭：{error}");
                                        let _ = window.eval(format!("window.__HAIFENG_HOST__?.cancelExit({id});"));
                                    } else {
                                        STOP_HEARTBEAT.store(true, Ordering::SeqCst);
                                    }
                                }
                                EXIT_RUNNING.store(false, Ordering::SeqCst);
                                return;
                            }
                            "pending" => {}
                            "cancelled" | "failed" | "unavailable" => break,
                            _ => {
                                eprintln!("退出返回状态无效，保留窗口");
                                break;
                            }
                        },
                        _ => {
                            eprintln!("页面尚未确认退出，保留窗口");
                            break;
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(_) => break,
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        if PAGE_SEQUENCE.load(Ordering::SeqCst) == page {
            let _ = window.eval(format!("window.__HAIFENG_HOST__?.cancelExit({id});"));
        }
        EXIT_RUNNING.store(false, Ordering::SeqCst);
    }).is_err() {
        EXIT_RUNNING.store(false, Ordering::SeqCst);
        eprintln!("无法建立退出协调任务，保留窗口");
    }
}

fn warn_delivery() {
    if !DELIVERY_WARNED.swap(true, Ordering::SeqCst) {
        eprintln!("游戏页尚未确认窗口状态，宿主将周期重试；页面超时后保持暂停");
    }
}

fn publish(window: &WebviewWindow) {
    publish_fullscreen(window);
    let paused = !window.is_focused().unwrap_or(false)
        || window.is_minimized().unwrap_or(true);
    let sequence = SEQUENCE.fetch_add(1, Ordering::SeqCst) + 1;
    let script = format!(
        "(() => {{const b=window.__HAIFENG_HOST__; if(b?.protocol!=='haifeng.host-bridge/3') return null; b.receive({{format:'haifeng.host-state/1',platform:'windows-trial',sequence:{sequence},paused:{paused}}); return b.read().sequence;}})()"
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
    let file_records = std::env::args_os().skip(1).any(|argument| argument == "--rebuild-file-records");
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if window.label() == "rebuild" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                        request_exit(webview);
                    }
                }
            }
            if window.label() == "rebuild" && matches!(event, WindowEvent::Destroyed) {
                STOP_HEARTBEAT.store(true, Ordering::SeqCst);
            }
            if matches!(event, WindowEvent::Focused(_) | WindowEvent::Resized(_)) {
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    publish(&webview);
                }
            }
        })
        .setup(move |app| {
            let asset = app.asset_resolver().get("game-package.json".into())
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "缺少游戏包清单，请重新准备"))?;
            let manifest: serde_json::Value = serde_json::from_slice(&asset.bytes)?;
            if manifest["format"] != "haifeng.game-package/2" || manifest["hostBridge"] != "haifeng.host-bridge/3" {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "游戏包与宿主协议不匹配，请重新构建并准备").into());
            }
            let work_id = manifest["workId"].as_str()
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "游戏包缺少作品身份"))?.to_owned();
            if file_records {
                let registered = manifest["frontend"].as_array().map(|files| {
                    files.iter().any(|file| file["path"] == "assets/native-record-client.json")
                }).unwrap_or(false);
                let capability = app.asset_resolver().get("assets/native-record-client.json".into())
                    .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "此游戏包没有原生记录客户端，请重新构建并准备"))?;
                let capability: serde_json::Value = serde_json::from_slice(&capability.bytes)?;
                if !registered || capability.as_object().map(|value| value.len()) != Some(2)
                    || capability["format"] != "haifeng.native-record-client/1"
                    || capability["protocol"] != "haifeng.native-records/1" {
                    return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "原生记录客户端能力与当前游戏包不匹配").into());
                }
            }
            let local_data = app.path().app_local_data_dir()?;
            #[cfg(target_os = "windows")]
            let native_store = if file_records {
                Some(std::sync::Arc::new(crate::rebuild_storage::NativeRecordStore::open(
                    local_data.join("native-records-trial"), work_id.clone(),
                )?))
            } else { None };
            let data = local_data.join("webview");
            std::fs::create_dir_all(&data)?;
            let records_bootstrap = include_str!("../../../packages/player/src/web/native-records-bootstrap.js")
                .replace("__HAIFENG_RECORD_PLATFORM__", "windows-trial")
                .replace("__HAIFENG_FILE_RECORDS__", if file_records { "true" } else { "false" })
                .replace("__HAIFENG_RECORD_WORK__", &serde_json::to_string(&work_id)?);
            let bootstrap = format!("{records_bootstrap}\n{}", include_str!("../../../packages/player/src/web/host-bootstrap.js")
                .replace("__HAIFENG_PLATFORM__", "windows-trial"));
            WebviewWindowBuilder::new(app, "rebuild", WebviewUrl::App("index.html".into()))
                .title(if file_records { "海风与布丁 · 文件记录试用" } else { "海风与布丁 · 重构集成试用" })
                .inner_size(1440.0, 810.0)
                .min_inner_size(960.0, 540.0)
                .center()
                .use_https_scheme(true)
                .data_directory(data)
                .initialization_script(bootstrap)
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
                    if matches!(payload.event(), PageLoadEvent::Started) {
                        PAGE_READY.store(false, Ordering::SeqCst);
                        PAGE_SEQUENCE.fetch_add(1, Ordering::SeqCst);
                    }
                    if matches!(payload.event(), PageLoadEvent::Finished) {
                        PAGE_READY.store(true, Ordering::SeqCst);
                        publish(&window);
                    }
                })
                .build()?;
            #[cfg(target_os = "windows")]
            if let Some(store) = native_store { records_bridge::start(app.handle().clone(), store, work_id)?; }
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
