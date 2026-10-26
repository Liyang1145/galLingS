//! Windows audio permission coordinator. No device IDs cross this boundary.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use super::audio_devices::{Monitor, Wake};

#[derive(Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action { Request, Release }
#[derive(Clone, PartialEq, Eq, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    id: u64,
    owner: String,
    generation: u64,
    action: Action,
}
#[derive(Clone)]
struct Command { page: u64, request: Request }
#[derive(Clone, Copy)]
enum Status { NotRequested, Granted, Interrupted, Denied }
impl Status {
    fn text(self) -> &'static str {
        match self {
            Self::NotRequested => "not-requested", Self::Granted => "granted",
            Self::Interrupted => "interrupted", Self::Denied => "denied",
        }
    }
    fn interrupted(self) -> Self {
        match self { Self::Granted | Self::Interrupted => Self::Interrupted, other => other }
    }
}
struct State {
    ready: bool,
    initial: bool,
    generation: u64,
    status: Status,
    issue: Option<String>,
    binding: Option<(u64, String)>,
    request: Option<Request>,
    acknowledged: bool,
    wake: Option<Wake>,
}
pub struct Output {
    state: Mutex<State>,
    sequence: AtomicU64,
    stopped: AtomicBool,
    commands: mpsc::SyncSender<Command>,
}
pub struct Snapshot {
    pub value: serde_json::Value,
    pub paused: bool,
}
impl Output {
    /// COM is created only inside this new worker, never on the WebView/UI thread.
    pub fn start() -> std::io::Result<Arc<Self>> {
        let (sender, receiver) = mpsc::sync_channel(1);
        let output = Arc::new(Self {
            state: Mutex::new(State {
                ready: false, initial: true, generation: 1, status: Status::NotRequested, issue: None,
                binding: None, request: None, acknowledged: false, wake: None,
            }),
            sequence: AtomicU64::new(0), stopped: AtomicBool::new(false), commands: sender,
        });
        let owner = output.clone();
        std::thread::Builder::new().name("haifeng-audio-output".into()).spawn(move || owner.run(receiver))?;
        Ok(output)
    }

    pub fn bind(&self, page: u64, owner: &str) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|_| "声音许可状态不可用")?;
        if self.stopped.load(Ordering::SeqCst) || super::PAGE_SEQUENCE.load(Ordering::SeqCst) != page {
            return Err("声音许可页面已失效".into());
        }
        if state.binding.as_ref().map(|(old_page, old_owner)| *old_page == page && old_owner == owner).unwrap_or(false) {
            return Ok(());
        }
        if state.binding.is_some() {
            // A prior document's completed or late request is not a new-page permission.
            state.status = Status::NotRequested;
            state.issue = None;
            state.initial = false;
        }
        state.binding = Some((page, owner.to_owned()));
        state.request = None;
        state.acknowledged = false;
        Ok(())
    }
    pub fn snapshot(&self, page: u64, owner: &str) -> Result<Snapshot, String> {
        let state = self.state.lock().map_err(|_| "声音许可状态不可用")?;
        if self.stopped.load(Ordering::SeqCst)
            || state.binding.as_ref().map(|(bound, identity)| *bound == page && identity == owner) != Some(true) {
            return Err("声音许可不属于当前页面".into());
        }
        let mut generation = state.generation;
        let mut status = state.status;
        let mut issue = state.issue.clone();
        if let Some(wake) = &state.wake {
            match wake.generation() {
                Ok(current) if current > generation => {
                    generation = current;
                    status = status.interrupted();
                    issue = Some("声音输出设备发生变化；确认设备后点击“启用声音”重试。".into());
                }
                Ok(_) => {}
                Err(message) => { status = Status::Interrupted; issue = Some(message); }
            }
        }
        let request = if state.acknowledged { state.request.as_ref() } else { None };
        if generation > 9_007_199_254_740_991 { return Err("声音输出代次已耗尽，请重新启动宿主".into()); }
        let sequence = self.sequence.fetch_add(1, Ordering::SeqCst) + 1;
        if sequence >= 9_007_199_254_740_991 { return Err("声音许可序号已耗尽，请重新启动宿主".into()); }
        Ok(Snapshot {
            paused: matches!(status, Status::Interrupted),
            value: serde_json::json!({
                "format": "haifeng.audio-output-state/1", "sequence": sequence,
                "generation": generation, "ready": state.ready, "status": status.text(),
                "requestId": request.map(|value| value.id),
                "requestOwner": request.map(|value| value.owner.as_str()), "issue": issue,
            }),
        })
    }

    pub fn submit(&self, page: u64, request: Request) -> Result<(), String> {
        if self.stopped.load(Ordering::SeqCst) || request.id == 0 || request.id > 9_007_199_254_740_991
            || request.generation == 0 || request.generation > 9_007_199_254_740_991
            || request.owner.len() != 32 || !request.owner.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("声音请求身份无效".into());
        }
        let mut state = self.state.lock().map_err(|_| "声音许可状态不可用")?;
        if self.stopped.load(Ordering::SeqCst) || super::STOP_HEARTBEAT.load(Ordering::SeqCst)
            || state.binding.as_ref().map(|(bound, owner)| *bound == page && owner == &request.owner) != Some(true)
            || super::PAGE_SEQUENCE.load(Ordering::SeqCst) != page {
            return Err("声音请求页面已失效".into());
        }
        if let Some(previous) = &state.request {
            if request.id < previous.id { return Ok(()); }
            if request.id == previous.id {
                return if previous == &request { Ok(()) } else { Err("同一声音请求 ID 的载荷不一致".into()) };
            }
        }
        state.request = Some(request.clone());
        state.acknowledged = false;
        if self.commands.try_send(Command { page, request }).is_err() {
            state.issue = Some("声音请求未交付，请稍后显式重试。".into());
            state.acknowledged = true;
        }
        let wake = state.wake.clone();
        drop(state);
        if let Some(wake) = wake { let _ = wake.signal(); }
        super::power::notify_host();
        Ok(())
    }
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        if let Ok(state) = self.state.lock() {
            if let Some(wake) = &state.wake { wake.cancel(); }
        }
    }

    fn current(&self, state: &State, command: &Command) -> bool {
        !self.stopped.load(Ordering::SeqCst) && !super::STOP_HEARTBEAT.load(Ordering::SeqCst)
            && super::PAGE_SEQUENCE.load(Ordering::SeqCst) == command.page
            && state.binding.as_ref().map(|(page, owner)| *page == command.page && owner == &command.request.owner) == Some(true)
            && state.request.as_ref() == Some(&command.request)
    }
    fn unavailable(&self, message: String) {
        if let Ok(mut state) = self.state.lock() {
            state.ready = true;
            state.status = match state.status { Status::NotRequested | Status::Denied => Status::Denied, other => other.interrupted() };
            state.issue = Some(message);
            state.wake = None;
        }
        super::power::notify_host();
    }
    fn changed(&self, monitor: &mut Monitor) -> Result<(), String> {
        let inspection = monitor.inspect()?;
        let mut state = self.state.lock().map_err(|_| "声音许可状态不可用")?;
        if inspection.generation != state.generation {
            state.generation = inspection.generation;
            state.status = state.status.interrupted();
            state.issue = Some("声音输出设备发生变化；确认设备后点击“启用声音”重试。".into());
        }
        drop(state);
        super::power::notify_host();
        Ok(())
    }
    fn process(&self, command: Command, monitor: Option<&mut Monitor>) {
        {
            let Ok(state) = self.state.lock() else { return };
            if !self.current(&state, &command) { return; }
        }
        let inspection = if command.request.action == Action::Request {
            Some(match monitor {
                Some(monitor) => monitor.inspect(),
                None => Err("系统声音输出监听不可用；本次保持静音，请重新启动宿主后再试。".into()),
            })
        } else { None };
        let Ok(mut state) = self.state.lock() else { return };
        if !self.current(&state, &command) { return; }
        state.ready = true;
        match inspection {
            None => { state.status = Status::NotRequested; state.issue = None; }
            Some(Ok(value)) => {
                state.generation = value.generation;
                if !value.stable || value.generation != command.request.generation {
                    state.status = Status::Interrupted;
                    state.issue = Some("处理请求时输出设备又有变化，未采用原声音请求；请重新确认后重试。".into());
                } else if value.available {
                    state.status = Status::Granted;
                    state.issue = None;
                } else {
                    state.status = Status::Denied;
                    state.issue = Some("当前没有活动的默认播放端点，本次可静音继续。".into());
                }
            }
            Some(Err(message)) => { state.status = Status::Denied; state.issue = Some(message); }
        }
        state.acknowledged = true;
        drop(state);
        super::power::notify_host();
    }
    fn run(self: Arc<Self>, receiver: mpsc::Receiver<Command>) {
        let mut monitor = match Monitor::open() {
            Ok(mut monitor) => {
                match monitor.inspect() {
                    Ok(inspection) => {
                        if let Ok(mut state) = self.state.lock() {
                            state.ready = true;
                            state.generation = inspection.generation;
                            state.status = if !state.initial { Status::NotRequested } else if !inspection.stable { Status::Interrupted }
                                else if inspection.available { Status::Granted } else { Status::Denied };
                            state.issue = if !state.initial { None } else if !inspection.stable { Some("初始化期间声音输出变化，请确认后重试。".into()) }
                                else if !inspection.available { Some("当前没有活动的默认播放端点，可静音继续。".into()) } else { None };
                            state.wake = Some(monitor.wake());
                        }
                        super::power::notify_host();
                        Some(monitor)
                    }
                    Err(message) => { self.unavailable(message); None }
                }
            }
            Err(message) => { self.unavailable(message); None }
        };
        while !self.stopped.load(Ordering::SeqCst) {
            if let Some(active) = monitor.as_mut() {
                if let Ok(command) = receiver.try_recv() { self.process(command, Some(&mut *active)); }
                if self.stopped.load(Ordering::SeqCst) { break; }
                let observed = active.generation();
                let confirmed = self.state.lock().ok().map(|state| state.generation);
                match observed {
                    Ok(generation) if confirmed != Some(generation) => {
                        if let Err(message) = self.changed(active) { self.unavailable(message); monitor = None; continue; }
                    }
                    Err(message) => { self.unavailable(message); monitor = None; continue; }
                    _ => {}
                }
                if let Err(message) = active.wait(Duration::from_millis(500)) {
                    self.unavailable(message);
                    monitor = None;
                }
            } else {
                match receiver.recv_timeout(Duration::from_millis(500)) {
                    Ok(command) => self.process(command, None),
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        }
        // Dropping the monitor unregisters on this same COM worker; no UI join/wait.
        drop(monitor);
        if let Ok(mut state) = self.state.lock() {
            state.wake = None;
            state.binding = None;
            state.request = None;
            state.acknowledged = false;
            state.ready = false;
            state.status = Status::NotRequested;
        }
    }
}
