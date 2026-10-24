//! Windows-only MMDevice observation. Construct, inspect and drop on one worker thread.
//! The public view has no endpoint IDs, recording, device selection or story/storage access.
use std::ffi::c_void;
use std::ptr;
use std::sync::atomic::{fence, AtomicBool, AtomicPtr, AtomicU32, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

type HResult = i32;
const E_POINTER: HResult = 0x8000_4003_u32 as i32;
const E_NOINTERFACE: HResult = 0x8000_4002_u32 as i32;
const E_NOTFOUND: HResult = 0x8007_0490_u32 as i32;
const MAX_ID_UNITS: usize = 4096;

#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq)]
struct Guid { a: u32, b: u16, c: u16, d: [u8; 8] }
const ENUMERATOR_CLASS: Guid = Guid { a: 0xbcde0395, b: 0xe52f, c: 0x467c, d: [0x8e, 0x3d, 0xc4, 0x57, 0x92, 0x91, 0x69, 0x2e] };
const ENUMERATOR_IID: Guid = Guid { a: 0xa95664d2, b: 0x9614, c: 0x4f35, d: [0xa7, 0x46, 0xde, 0x8d, 0xb6, 0x36, 0x17, 0xe6] };
const NOTIFICATION_IID: Guid = Guid { a: 0x7991eec9, b: 0x7e89, c: 0x4d85, d: [0x83, 0x90, 0x6c, 0x70, 0x3c, 0xec, 0x60, 0xc0] };
const UNKNOWN_IID: Guid = Guid { a: 0, b: 0, c: 0, d: [0xc0, 0, 0, 0, 0, 0, 0, 0x46] };

#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reserved: *mut c_void, mode: u32) -> HResult;
    fn CoUninitialize();
    fn CoCreateInstance(class: *const Guid, outer: *mut c_void, context: u32, iid: *const Guid, result: *mut *mut c_void) -> HResult;
    fn CoTaskMemFree(memory: *mut c_void);
}
#[link(name = "kernel32")]
extern "system" {
    fn CreateEventW(attributes: *mut c_void, manual_reset: i32, initial: i32, name: *const u16) -> *mut c_void;
    fn SetEvent(event: *mut c_void) -> i32;
    fn WaitForSingleObject(handle: *mut c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}

// Minimal C ABI layout from Microsoft's mmdeviceapi.h. Unused slots retain their
// pointer width/order; this module never calls them or activates an audio stream.
#[repr(C)]
struct UnknownTable {
    query: unsafe extern "system" fn(*mut c_void, *const Guid, *mut *mut c_void) -> HResult,
    add_ref: unsafe extern "system" fn(*mut c_void) -> u32,
    release: unsafe extern "system" fn(*mut c_void) -> u32,
}
#[repr(C)]
struct EnumeratorTable {
    unknown: UnknownTable,
    enumerate_unused: usize,
    default: unsafe extern "system" fn(*mut c_void, i32, i32, *mut *mut c_void) -> HResult,
    get_unused: usize,
    register: unsafe extern "system" fn(*mut c_void, *mut c_void) -> HResult,
    unregister: unsafe extern "system" fn(*mut c_void, *mut c_void) -> HResult,
}
#[repr(C)]
struct DeviceTable {
    unknown: UnknownTable,
    activate_unused: usize,
    properties_unused: usize,
    id: unsafe extern "system" fn(*mut c_void, *mut *mut u16) -> HResult,
    state: unsafe extern "system" fn(*mut c_void, *mut u32) -> HResult,
}
#[repr(C)]
struct PropertyKey { format: Guid, id: u32 }
#[repr(C)]
struct NotificationTable {
    unknown: UnknownTable,
    state_changed: unsafe extern "system" fn(*mut c_void, *const u16, u32) -> HResult,
    added: unsafe extern "system" fn(*mut c_void, *const u16) -> HResult,
    removed: unsafe extern "system" fn(*mut c_void, *const u16) -> HResult,
    default_changed: unsafe extern "system" fn(*mut c_void, i32, i32, *const u16) -> HResult,
    property_changed: unsafe extern "system" fn(*mut c_void, *const u16, PropertyKey) -> HResult,
}
#[repr(C)]
struct Client {
    table: &'static NotificationTable,
    references: AtomicU32,
    signals: Arc<Signals>,
}
static NOTIFICATION_TABLE: NotificationTable = NotificationTable {
    unknown: UnknownTable { query: query_client, add_ref: add_client, release: release_client },
    state_changed: device_state, added: device_added, removed: device_removed,
    default_changed: default_device, property_changed: property_changed,
};

#[derive(PartialEq, Eq)]
struct Routes(Vec<Vec<u16>>);
struct Signals {
    event: usize,
    alive: AtomicBool,
    failed: AtomicBool,
    generation: AtomicU64,
    readers: AtomicUsize,
    routes: AtomicPtr<Routes>,
}
impl Signals {
    fn changed(&self) {
        if !self.alive.load(Ordering::SeqCst) { return; }
        if self.generation.fetch_update(Ordering::SeqCst, Ordering::SeqCst,
            |current| current.checked_add(1)).is_err() {
            self.failed.store(true, Ordering::SeqCst);
        }
        // Signalling only: callback threads never wait or query/release MMDevice objects.
        if unsafe { SetEvent(self.event as *mut c_void) } == 0 {
            self.failed.store(true, Ordering::SeqCst);
        }
        super::power::notify_host();
    }
    fn fault(&self) {
        self.failed.store(true, Ordering::SeqCst);
        self.changed();
    }
    unsafe fn matches_output(&self, id: *const u16) -> bool {
        if id.is_null() { self.fault(); return false; }
        self.readers.fetch_add(1, Ordering::SeqCst);
        let routes = self.routes.load(Ordering::SeqCst);
        let found = if !self.alive.load(Ordering::SeqCst) { false }
            else if routes.is_null() { true } // Initialization has not established a route yet.
            else {
                // IDs are opaque, bounded NUL-terminated UTF-16. Stop at the
                // first difference/NUL; never read beyond the OS string terminator.
                (*routes).0.iter().any(|known| {
                    for (offset, expected) in known.iter().enumerate() {
                        let actual = *id.add(offset);
                        if actual != *expected { return false; }
                        if actual == 0 { return true; }
                    }
                    false
                })
            };
        self.readers.fetch_sub(1, Ordering::SeqCst);
        found
    }
    fn replace_routes(&self, routes: Routes) {
        let current = self.routes.load(Ordering::SeqCst);
        // Only the owning worker replaces snapshots; callbacks only borrow them.
        if !current.is_null() && unsafe { &*current == &routes } { return; }
        let previous = self.routes.swap(Box::into_raw(Box::new(routes)), Ordering::SeqCst);
        // Callback readers never wait. The worker retires the old immutable
        // snapshot only after every reader that could have loaded it has left.
        while self.readers.load(Ordering::SeqCst) != 0 { std::thread::yield_now(); }
        if !previous.is_null() { unsafe { drop(Box::from_raw(previous)); } }
    }
}
impl Drop for Signals {
    fn drop(&mut self) {
        let routes = self.routes.load(Ordering::SeqCst);
        // The final Arc is released after the callback object is no longer in use.
        if !routes.is_null() { unsafe { drop(Box::from_raw(routes)); } }
        unsafe { CloseHandle(self.event as *mut c_void); }
    }
}

unsafe extern "system" fn query_client(this: *mut c_void, iid: *const Guid, output: *mut *mut c_void) -> HResult {
    if this.is_null() || iid.is_null() || output.is_null() { return E_POINTER; }
    *output = ptr::null_mut();
    if *iid != UNKNOWN_IID && *iid != NOTIFICATION_IID { return E_NOINTERFACE; }
    add_client(this);
    *output = this;
    0
}
unsafe extern "system" fn add_client(this: *mut c_void) -> u32 {
    let client = &*(this as *mut Client);
    match client.references.fetch_update(Ordering::AcqRel, Ordering::Acquire, |value| value.checked_add(1)) {
        Ok(previous) => previous + 1,
        Err(_) => { client.signals.fault(); u32::MAX }
    }
}
unsafe extern "system" fn release_client(this: *mut c_void) -> u32 {
    let client = &*(this as *mut Client);
    match client.references.fetch_update(Ordering::Release, Ordering::Relaxed, |value| value.checked_sub(1)) {
        Ok(1) => { fence(Ordering::Acquire); drop(Box::from_raw(this as *mut Client)); 0 }
        Ok(previous) => previous - 1,
        Err(_) => { client.signals.fault(); 0 }
    }
}
unsafe extern "system" fn device_state(this: *mut c_void, id: *const u16, _state: u32) -> HResult {
    let signals = &(*(this as *mut Client)).signals;
    if signals.matches_output(id) { signals.changed(); }
    0
}
unsafe extern "system" fn device_removed(this: *mut c_void, id: *const u16) -> HResult {
    let signals = &(*(this as *mut Client)).signals;
    if signals.matches_output(id) { signals.changed(); }
    0
}
unsafe extern "system" fn device_added(_this: *mut c_void, _id: *const u16) -> HResult { 0 }
unsafe extern "system" fn property_changed(_this: *mut c_void, _id: *const u16, _key: PropertyKey) -> HResult { 0 }
unsafe extern "system" fn default_device(this: *mut c_void, flow: i32, role: i32, _id: *const u16) -> HResult {
    let signals = &(*(this as *mut Client)).signals;
    if flow == 0 && (0..=2).contains(&role) { signals.changed(); }
    else if flow != 1 { signals.fault(); }
    0
}

struct Apartment;
impl Drop for Apartment { fn drop(&mut self) { unsafe { CoUninitialize(); } } }
struct ComObject(*mut c_void);
impl Drop for ComObject {
    fn drop(&mut self) {
        // All system objects here have the documented IUnknown prefix and one owned reference.
        unsafe {
            let table = *(self.0 as *const *const UnknownTable);
            ((*table).release)(self.0);
        }
    }
}
struct TaskString(*mut u16);
impl Drop for TaskString { fn drop(&mut self) { unsafe { CoTaskMemFree(self.0.cast()); } } }
fn check(result: HResult, action: &str) -> Result<(), String> {
    if result == 0 { Ok(()) } else { Err(format!("{action}未确认（系统状态 {:08x}）", result as u32)) }
}

pub struct Inspection {
    pub generation: u64,
    pub available: bool,
    pub stable: bool,
}
#[derive(Clone)]
pub struct Wake(Arc<Signals>);
impl Wake {
    pub fn cancel(&self) {
        self.0.alive.store(false, Ordering::SeqCst);
        unsafe { SetEvent(self.0.event as *mut c_void); }
        super::power::notify_host();
    }
    pub fn generation(&self) -> Result<u64, String> {
        if !self.0.alive.load(Ordering::SeqCst) { return Err("声音输出监听已停止".into()); }
        if self.0.failed.load(Ordering::SeqCst) { return Err("声音输出监听状态异常，请重新启动宿主".into()); }
        Ok(self.0.generation.load(Ordering::SeqCst))
    }
    pub fn signal(&self) -> Result<(), String> {
        if !self.0.alive.load(Ordering::SeqCst) { return Err("声音输出监听已停止".into()); }
        if unsafe { SetEvent(self.0.event as *mut c_void) } == 0 { return Err("无法唤醒声音输出线程".into()); }
        Ok(())
    }
}
/// Not Send/Sync: COM registration, route queries and cleanup stay on the constructing worker.
pub struct Monitor {
    apartment: Option<Apartment>,
    enumerator: Option<ComObject>,
    client: *mut Client,
    signals: Arc<Signals>,
}
impl Monitor {
    pub fn open() -> Result<Self, String> {
        // A dedicated MTA avoids changing the WebView UI thread's COM apartment.
        let initialized = unsafe { CoInitializeEx(ptr::null_mut(), 0) };
        if initialized != 0 && initialized != 1 { check(initialized, "初始化声音监听线程")?; }
        let apartment = Apartment;
        let mut enumerator = ptr::null_mut();
        check(unsafe { CoCreateInstance(&ENUMERATOR_CLASS, ptr::null_mut(), 1, &ENUMERATOR_IID, &mut enumerator) }, "创建系统声音目录")?;
        if enumerator.is_null() { return Err("系统声音目录没有返回有效对象".into()); }
        let enumerator = ComObject(enumerator);
        let event = unsafe { CreateEventW(ptr::null_mut(), 0, 0, ptr::null()) };
        if event.is_null() { return Err("无法创建声音变化通知".into()); }
        let signals = Arc::new(Signals {
            event: event as usize, alive: AtomicBool::new(true), failed: AtomicBool::new(false),
            generation: AtomicU64::new(1), readers: AtomicUsize::new(0), routes: AtomicPtr::new(ptr::null_mut()),
        });
        let client = Box::into_raw(Box::new(Client {
            table: &NOTIFICATION_TABLE, references: AtomicU32::new(1), signals: signals.clone(),
        }));
        let table = unsafe { &**(enumerator.0 as *const *const EnumeratorTable) };
        let status = unsafe { (table.register)(enumerator.0, client.cast()) };
        if status != 0 {
            signals.alive.store(false, Ordering::SeqCst);
            if status < 0 { unsafe { release_client(client.cast()); } }
            else {
                // Only documented S_OK confirms registration. An unknown
                // success-like status must not free a possibly retained callback.
                std::mem::forget(enumerator);
                std::mem::forget(apartment);
            }
            return Err(format!("登记声音输出通知未确认（系统状态 {:08x}）", status as u32));
        }
        // Register/Unregister do not AddRef/Release the callback: own a separate registration reference.
        unsafe { add_client(client.cast()); }
        Ok(Self { apartment: Some(apartment), enumerator: Some(enumerator), client, signals })
    }

    pub fn generation(&self) -> Result<u64, String> {
        if !self.signals.alive.load(Ordering::SeqCst) { return Err("声音输出监听已停止".into()); }
        if self.signals.failed.load(Ordering::SeqCst) { return Err("声音输出监听状态异常，请重新启动宿主".into()); }
        Ok(self.signals.generation.load(Ordering::SeqCst))
    }
    pub fn wake(&self) -> Wake { Wake(self.signals.clone()) }
    pub fn wait(&self, timeout: Duration) -> Result<bool, String> {
        self.generation()?;
        let milliseconds = u32::try_from(timeout.as_millis()).map_err(|_| "声音监听等待范围无效")?;
        if milliseconds == u32::MAX { return Err("声音监听不接受无限等待".into()); }
        match unsafe { WaitForSingleObject(self.signals.event as *mut c_void, milliseconds) } {
            0 => Ok(true),
            0x102 => Ok(false),
            _ => Err("等待系统声音变化失败".into()),
        }
    }

    pub fn inspect(&mut self) -> Result<Inspection, String> {
        let before = self.generation()?;
        let enumerator = self.enumerator.as_ref().ok_or("声音输出监听已释放")?;
        let table = unsafe { &**(enumerator.0 as *const *const EnumeratorTable) };
        let mut routes = Vec::new();
        for role in 0..=2 {
            let mut device = ptr::null_mut();
            let result = unsafe { (table.default)(enumerator.0, 0, role, &mut device) };
            if result == E_NOTFOUND { continue; }
            check(result, "读取默认声音输出")?;
            if device.is_null() { return Err("默认声音输出没有返回有效对象".into()); }
            let device = ComObject(device);
            let device_table = unsafe { &**(device.0 as *const *const DeviceTable) };
            let mut state = 0_u32;
            check(unsafe { (device_table.state)(device.0, &mut state) }, "读取声音输出状态")?;
            if !matches!(state, 1 | 2 | 4 | 8) { return Err("系统声音输出状态不受支持".into()); }
            if state != 1 { continue; }
            let mut identity = ptr::null_mut();
            check(unsafe { (device_table.id)(device.0, &mut identity) }, "读取声音输出身份")?;
            if identity.is_null() { return Err("声音输出身份缺失".into()); }
            let allocation = TaskString(identity);
            let mut units = Vec::new();
            for offset in 0..=MAX_ID_UNITS {
                let unit = unsafe { *allocation.0.add(offset) };
                units.push(unit);
                if unit == 0 { break; }
            }
            if units.len() < 2 || units.last() != Some(&0) || units.len() > MAX_ID_UNITS + 1 {
                return Err("声音输出身份长度超出本片支持范围".into());
            }
            String::from_utf16(&units[..units.len() - 1]).map_err(|_| "声音输出身份不是有效 UTF-16")?;
            if !routes.contains(&units) { routes.push(units); }
        }
        let available = !routes.is_empty();
        self.signals.replace_routes(Routes(routes));
        let generation = self.generation()?;
        Ok(Inspection { generation, available, stable: before == generation })
    }
}
impl Drop for Monitor {
    fn drop(&mut self) {
        self.signals.alive.store(false, Ordering::SeqCst);
        let Some(enumerator) = self.enumerator.as_ref() else { return };
        let table = unsafe { &**(enumerator.0 as *const *const EnumeratorTable) };
        let status = unsafe { (table.unregister)(enumerator.0, self.client.cast()) };
        if status != 0 {
            eprintln!("声音输出通知注销未确认（系统错误 {:08x}）；保留原生对象到进程结束，忽略迟到通知", status as u32);
            if let Some(value) = self.enumerator.take() { std::mem::forget(value); }
            if let Some(value) = self.apartment.take() { std::mem::forget(value); }
            // Both callback references and its Arc keep the event/immutable snapshots alive.
            return;
        }
        unsafe {
            release_client(self.client.cast()); // registration reference
            release_client(self.client.cast()); // owning reference
        }
        // Release the enumerator before CoUninitialize, on this same worker.
        self.enumerator.take();
        self.apartment.take();
    }
}
