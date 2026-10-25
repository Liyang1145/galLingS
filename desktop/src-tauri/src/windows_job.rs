//! Windows 子进程组：外壳退出（包括崩溃）时结束自己启动的 Python 子进程树。
//! 只使用系统自带的 Kernel32；不改变 Linux 宿主或引入另一套进程管理器。
use std::ffi::c_void;
use std::io;
use std::os::windows::io::AsRawHandle;
use std::process::Child;

#[repr(C)]
#[derive(Default)]
struct BasicLimits {
    process_time: i64,
    job_time: i64,
    flags: u32,
    min_working_set: usize,
    max_working_set: usize,
    active_processes: u32,
    affinity: usize,
    priority: u32,
    scheduling: u32,
}

#[repr(C)]
#[derive(Default)]
struct ExtendedLimits {
    basic: BasicLimits,
    io_counters: [u64; 6],
    process_memory: usize,
    job_memory: usize,
    peak_process_memory: usize,
    peak_job_memory: usize,
}

#[link(name = "kernel32")]
extern "system" {
    fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> *mut c_void;
    fn SetInformationJobObject(job: *mut c_void, class: i32, info: *const c_void, len: u32) -> i32;
    fn AssignProcessToJobObject(job: *mut c_void, process: *mut c_void) -> i32;
    fn CloseHandle(handle: *mut c_void) -> i32;
}

/// 用整数保存进程私有 HANDLE，使包含它的 Mutex 可在线程间安全传递。
/// HANDLE 只由本实例关闭；Python Child 的句柄仍归 std::process::Child 管理。
pub struct PythonJob(isize);

impl PythonJob {
    pub fn bind(child: &Child) -> io::Result<Self> {
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = Self(handle as isize);
            let mut limits = ExtendedLimits::default();
            limits.basic.flags = 0x0000_2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if SetInformationJobObject(
                handle,
                9, // JobObjectExtendedLimitInformation
                &limits as *const _ as *const c_void,
                std::mem::size_of::<ExtendedLimits>() as u32,
            ) == 0
            {
                return Err(io::Error::last_os_error());
            }
            if AssignProcessToJobObject(handle, child.as_raw_handle() as *mut c_void) == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(job)
        }
    }
}

impl Drop for PythonJob {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0 as *mut c_void); }
    }
}
