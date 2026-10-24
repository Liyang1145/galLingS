//! Process-local Windows suspend/resume notification. No story, storage or page commands.
use std::ffi::c_void;
use std::io;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Condvar, Mutex};
use std::time::Duration;

const DEVICE_NOTIFY_CALLBACK: u32 = 2;
const LOAD_LIBRARY_SEARCH_SYSTEM32: u32 = 0x0000_0800;
const PBT_APMSUSPEND: u32 = 0x0004;
const PBT_APMRESUMECRITICAL: u32 = 0x0006;
const PBT_APMRESUMESUSPEND: u32 = 0x0007;
const PBT_APMRESUMEAUTOMATIC: u32 = 0x0012;
type PowerCallback = unsafe extern "system" fn(*mut c_void, u32, *mut c_void) -> u32;
type Register = unsafe extern "system" fn(u32, *mut c_void, *mut *mut c_void) -> u32;
type Unregister = unsafe extern "system" fn(*mut c_void) -> u32;

#[repr(C)]
struct SubscribeParameters {
    callback: PowerCallback,
    context: *mut c_void,
}
// SAFETY: the only instance is immutable, process-lived, and its context is
// permanently null. The callback reads only the synchronized static state below.
unsafe impl Sync for SubscribeParameters {}
static PARAMETERS: SubscribeParameters = SubscribeParameters {
    callback: power_event,
    context: std::ptr::null_mut(),
};

#[link(name = "kernel32")]
extern "system" {
    fn LoadLibraryExW(name: *const u16, reserved: *mut c_void, flags: u32) -> *mut c_void;
    fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
    fn FreeLibrary(module: *mut c_void) -> i32;
}

struct State {
    registered: bool,
    stopped: bool,
    failed: bool,
    suspended: bool,
    awaiting_user: bool,
    generation: u64,
    revision: u64,
    acknowledged: Option<(u64, u64)>,
}
static STATE: Mutex<State> = Mutex::new(State {
    registered: false, stopped: true, failed: false, suspended: false, awaiting_user: false,
    generation: 1, revision: 0, acknowledged: None,
});
static CHANGED: Condvar = Condvar::new();
static ATTEMPTED: AtomicBool = AtomicBool::new(false);
static WARNED: AtomicBool = AtomicBool::new(false);
static WAKE_REVISION: AtomicU64 = AtomicU64::new(0);

fn warn_state() {
    if !WARNED.swap(true, Ordering::SeqCst) {
        eprintln!("系统电源状态无法读取，重构宿主保持暂停；请停止后重新启动");
    }
}
impl State {
    fn interrupt(&mut self) {
        match self.generation.checked_add(1) {
            Some(next) => self.generation = next,
            None => self.failed = true,
        }
        self.acknowledged = None;
        self.revision = self.revision.saturating_add(1);
    }
}

unsafe extern "system" fn power_event(
    _context: *mut c_void, kind: u32, _setting: *mut c_void,
) -> u32 {
    // No allocation, window calls, file work or waiting for page acknowledgements here.
    // The callback/context remain alive even if unregister fails during shutdown.
    let Ok(mut state) = STATE.lock() else { return 1 };
    if state.stopped { return 0; }
    match kind {
        PBT_APMSUSPEND => {
            state.suspended = true;
            state.awaiting_user = true;
            state.interrupt();
        }
        PBT_APMRESUMEAUTOMATIC => {
            state.suspended = false;
            state.awaiting_user = true;
            // Resume also needs a pause acknowledgement: the pre-suspend page
            // notification may not have reached the WebView before it stopped.
            state.interrupt();
        }
        PBT_APMRESUMESUSPEND if state.suspended || state.awaiting_user => {
            state.suspended = false;
            state.awaiting_user = false;
            state.interrupt();
        }
        PBT_APMRESUMECRITICAL => {
            state.suspended = false;
            state.awaiting_user = true;
            state.failed = true;
            state.interrupt();
        }
        _ => return 0,
    }
    CHANGED.notify_all();
    0
}

struct Library(usize);
impl Drop for Library {
    fn drop(&mut self) {
        // SAFETY: exactly one successful LoadLibraryExW reference is owned here.
        unsafe { FreeLibrary(self.0 as *mut c_void); }
    }
}
pub struct Subscription {
    library: Option<Library>,
    registration: usize,
    unregister: Unregister,
}
impl Drop for Subscription {
    fn drop(&mut self) {
        stop();
        // SAFETY: this handle belongs to the resolved matching registration API.
        let result = unsafe { (self.unregister)(self.registration as *mut c_void) };
        if result != 0 {
            eprintln!("系统电源通知注销未确认（错误 {result}）；忽略迟到通知，保留系统模块到进程结束");
            // Do not unload the native module while its registration is uncertain.
            if let Some(library) = self.library.take() { std::mem::forget(library); }
        }
    }
}

/// Probe the fixed system DLL at runtime instead of adding a new static minimum-OS import.
pub fn subscribe() -> io::Result<Subscription> {
    if ATTEMPTED.swap(true, Ordering::SeqCst) {
        return Err(io::Error::new(io::ErrorKind::AlreadyExists, "系统电源通知只能为本进程登记一次"));
    }
    let name: Vec<u16> = "powrprof.dll".encode_utf16().chain(std::iter::once(0)).collect();
    // SAFETY: fixed NUL-terminated UTF-16 name, system directory only, reserved null.
    let handle = unsafe { LoadLibraryExW(name.as_ptr(), std::ptr::null_mut(), LOAD_LIBRARY_SEARCH_SYSTEM32) };
    if handle.is_null() {
        return Err(io::Error::new(io::ErrorKind::Unsupported, "无法加载系统电源通知模块，未启动重构游戏"));
    }
    let library = Library(handle as usize);
    // SAFETY: both fixed export names are NUL-terminated; the library reference is retained.
    let register_address = unsafe { GetProcAddress(handle, b"PowerRegisterSuspendResumeNotification\0".as_ptr()) };
    let unregister_address = unsafe { GetProcAddress(handle, b"PowerUnregisterSuspendResumeNotification\0".as_ptr()) };
    if register_address.is_null() || unregister_address.is_null() {
        return Err(io::Error::new(io::ErrorKind::Unsupported, "当前系统没有所需的休眠通知接口，未启动重构游戏"));
    }
    // SAFETY: signatures/struct layout follow powerbase.h and powrprof.h; no generic native calls.
    let register: Register = unsafe { std::mem::transmute(register_address) };
    let unregister: Unregister = unsafe { std::mem::transmute(unregister_address) };
    {
        let mut state = STATE.lock()
            .map_err(|_| io::Error::new(io::ErrorKind::Other, "无法初始化系统电源状态"))?;
        state.stopped = false;
    }
    let mut registration = std::ptr::null_mut();
    // PARAMETERS is process-lived; no assumption that the OS copies stack parameters.
    let status = unsafe {
        register(DEVICE_NOTIFY_CALLBACK, (&PARAMETERS as *const SubscribeParameters).cast_mut().cast(), &mut registration)
    };
    if status != 0 {
        stop();
        return Err(io::Error::new(io::ErrorKind::Other, format!("系统休眠通知登记失败（错误 {status}），未启动重构游戏")));
    }
    if registration.is_null() {
        stop();
        // A contradictory native result gives us no handle to unregister.
        // Retain the module rather than risk unloading an unknown registration.
        std::mem::forget(library);
        return Err(io::Error::new(io::ErrorKind::Other, "系统休眠通知没有返回有效登记身份，未启动重构游戏"));
    }
    let subscription = Subscription { library: Some(library), registration: registration as usize, unregister };
    {
        let mut state = STATE.lock()
            .map_err(|_| io::Error::new(io::ErrorKind::Other, "无法确认系统电源状态"))?;
        // Preserve a suspend/resume callback that may have arrived during registration.
        state.registered = true;
        state.revision = state.revision.saturating_add(1);
    }
    CHANGED.notify_all();
    Ok(subscription)
}

#[derive(Clone, Copy)]
pub struct Snapshot {
    pub sequence: u64,
    pub generation: Option<u64>,
    pub paused: bool,
}

/// Sampling and host sequence allocation share the notification lock. A delayed
/// pre-suspend sample cannot receive a sequence newer than the interruption.
pub fn snapshot(page: u64, sequence: &AtomicU64) -> Snapshot {
    match STATE.lock() {
        Ok(state) => {
            let needs_ack = state.acknowledged != Some((page, state.generation));
            let snapshot = Snapshot {
                sequence: sequence.fetch_add(1, Ordering::SeqCst) + 1,
                generation: needs_ack.then_some(state.generation),
                paused: !state.registered || state.stopped || state.failed || state.suspended || state.awaiting_user || needs_ack,
            };
            let failed = state.failed;
            drop(state);
            if failed { warn_state(); }
            snapshot
        }
        Err(_) => {
            warn_state();
            Snapshot {
                sequence: sequence.fetch_add(1, Ordering::SeqCst) + 1,
                generation: None, paused: true,
            }
        }
    }
}

/// Caller must also verify the original current page and host-state acknowledgement.
pub fn acknowledge(page: u64, generation: u64) {
    let Ok(mut state) = STATE.lock() else { warn_state(); return };
    if state.stopped || state.failed || !state.registered || generation != state.generation
        || state.acknowledged == Some((page, generation)) { return; }
    state.acknowledged = Some((page, generation));
    state.revision = state.revision.saturating_add(1);
    CHANGED.notify_all();
}

pub fn revision() -> Option<(u64, u64)> {
    match STATE.lock() {
        Ok(state) => Some((state.revision, WAKE_REVISION.load(Ordering::SeqCst))),
        Err(_) => { warn_state(); None }
    }
}
pub fn wait(observed: Option<(u64, u64)>, timeout: Duration) {
    match STATE.lock() {
        Ok(state) => {
            if state.stopped || Some((state.revision, WAKE_REVISION.load(Ordering::SeqCst))) != observed { return; }
            if CHANGED.wait_timeout_while(state, timeout,
                |current| !current.stopped && Some((current.revision, WAKE_REVISION.load(Ordering::SeqCst))) == observed).is_err() {
                warn_state();
                std::thread::sleep(timeout);
            }
        }
        Err(_) => { warn_state(); std::thread::sleep(timeout); }
    }
}
pub fn stop() {
    if let Ok(mut state) = STATE.lock() {
        state.stopped = true;
        state.registered = false;
        state.revision = state.revision.saturating_add(1);
    }
    CHANGED.notify_all();
}
/// Wake the existing host sampler for another native capability without changing power ownership.
pub fn notify_host() {
    // A native device callback may wake delivery without waiting for the power lock.
    // This counter is only a wake hint; it is never a permission/message identity.
    WAKE_REVISION.fetch_add(1, Ordering::SeqCst);
    CHANGED.notify_all();
}
