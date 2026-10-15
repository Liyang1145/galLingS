//! galcore：galLingS 的确定性核心（PLAN §3.1、§17.2）。
//!
//! 对外只有 JSON 字符串进出；Python 绑定在 `python` feature 下（maturin 打轮子）。

pub mod agm;
pub mod engine;
pub mod hash;

pub use engine::{Engine, EngineError, ENGINE_VERSION};

#[cfg(feature = "python")]
mod py {
    use crate::agm::Seed;
    use crate::engine::{Engine as Core, ENGINE_VERSION};
    use pyo3::exceptions::PyValueError;
    use pyo3::prelude::*;
    use serde_json::{json, Value};

    fn parse(s: &str, what: &str) -> PyResult<Value> {
        serde_json::from_str(s).map_err(|e| PyValueError::new_err(format!("{what} 不是合法 JSON：{e}")))
    }

    fn ev(e: crate::EngineError) -> PyErr {
        PyValueError::new_err(e.0)
    }

    /// `Engine(chapter_json, card_json, config_json, seed)`
    #[pyclass(unsendable)]
    pub struct Engine {
        inner: Core,
    }

    #[pymethods]
    impl Engine {
        #[new]
        fn new(chapter_json: &str, card_json: &str, config_json: &str, seed: u64) -> PyResult<Self> {
            let c = parse(chapter_json, "chapter")?;
            let k = parse(card_json, "card")?;
            let g = parse(config_json, "config")?;
            Ok(Engine { inner: Core::new(&c, &k, &g, seed).map_err(ev)? })
        }

        /// 处理一个事件，返回 `{ops, verdicts, state_hash, seq}` 的 JSON。
        fn step(&mut self, event_json: &str) -> PyResult<String> {
            let e = parse(event_json, "event")?;
            Ok(self.inner.step(&e).map_err(ev)?.to_string())
        }

        fn begin_turn(&mut self) -> PyResult<String> {
            self.step(r#"{"kind":"turn_begin"}"#)
        }
        fn commit_turn(&mut self) -> PyResult<String> {
            self.step(r#"{"kind":"turn_commit"}"#)
        }
        fn abort_turn(&mut self) -> PyResult<String> {
            self.step(r#"{"kind":"turn_abort"}"#)
        }

        fn state_json(&self) -> String {
            self.inner.state_json()
        }
        fn state_hash(&self) -> String {
            self.inner.state_hash()
        }
        fn snapshot(&self) -> PyResult<String> {
            self.inner.snapshot().map_err(ev)
        }
        fn restore(&mut self, snap: &str) -> PyResult<()> {
            self.inner.restore(snap).map_err(ev)
        }
        fn budget_json(&self) -> String {
            self.inner.budget_json()
        }
        fn visible_json(&self) -> String {
            serde_json::to_string(&self.inner.visible()).unwrap()
        }
        /// `seeds_json = [{"id":..., "score": 整数(×1000)}]`，返回 `[{id, activation, path}]`
        fn agm_recall(&self, seeds_json: &str, exclude_json: &str, k: usize) -> PyResult<String> {
            let seeds: Vec<Seed> = serde_json::from_str(seeds_json)
                .map_err(|e| PyValueError::new_err(format!("seeds：{e}")))?;
            let ex: Vec<String> = serde_json::from_str(exclude_json)
                .map_err(|e| PyValueError::new_err(format!("exclude：{e}")))?;
            Ok(self.inner.agm_recall(&seeds, &ex, k).to_string())
        }
        fn agm_stats(&self) -> String {
            json!({"edges": self.inner.agm.edges.len()}).to_string()
        }
    }

    #[pyfunction]
    fn fnv1a64(data: &str) -> String {
        crate::hash::hex64(crate::hash::fnv1a64(data.as_bytes()))
    }

    #[pymodule]
    fn _galcore(m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add_class::<Engine>()?;
        m.add_function(wrap_pyfunction!(fnv1a64, m)?)?;
        m.add("ENGINE_VERSION", ENGINE_VERSION)?;
        Ok(())
    }
}

/// 浏览器 / 桌面包里的引擎（PLAN §17.2）：编成 wasm32-unknown-unknown，不依赖 wasm-bindgen。
///
/// 约定只有字节进出：JS 先 `gc_alloc` 一块内存写入 UTF-8 JSON，再调函数；返回值是一块
/// `[len: u32 LE][utf-8 …]` 的内存，读完用 `gc_free_result` 还回来。错误时 JSON 是 `{"error": "…"}`。
/// 胶水在 web/offline/galcore-wasm.js，接口和 Python 绑定一一对应。
#[cfg(target_arch = "wasm32")]
mod wasm {
    use crate::agm::Seed;
    use crate::engine::{Engine as Core, ENGINE_VERSION};
    use serde_json::{json, Value};

    fn take(ptr: *mut u8, len: usize) -> String {
        if ptr.is_null() || len == 0 {
            return String::new();
        }
        let v = unsafe { Vec::from_raw_parts(ptr, len, len) };
        String::from_utf8(v).unwrap_or_default()
    }

    fn give(s: String) -> *mut u8 {
        let b = s.into_bytes();
        let mut out = Vec::with_capacity(b.len() + 4);
        out.extend_from_slice(&(b.len() as u32).to_le_bytes());
        out.extend_from_slice(&b);
        let mut out = out.into_boxed_slice();
        let p = out.as_mut_ptr();
        std::mem::forget(out);
        p
    }

    fn fail(m: impl std::fmt::Display) -> *mut u8 {
        give(json!({"error": m.to_string()}).to_string())
    }

    fn parse(s: &str, what: &str) -> Result<Value, String> {
        serde_json::from_str(s).map_err(|e| format!("{what} 不是合法 JSON：{e}"))
    }

    #[no_mangle]
    pub extern "C" fn gc_alloc(len: usize) -> *mut u8 {
        let mut v = Vec::<u8>::with_capacity(len.max(1));
        let p = v.as_mut_ptr();
        std::mem::forget(v);
        p
    }

    #[no_mangle]
    pub extern "C" fn gc_free_result(p: *mut u8) {
        if p.is_null() {
            return;
        }
        unsafe {
            let len = u32::from_le_bytes([*p, *p.add(1), *p.add(2), *p.add(3)]) as usize + 4;
            drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(p, len)));
        }
    }

    #[no_mangle]
    pub extern "C" fn gc_version() -> *mut u8 {
        give(ENGINE_VERSION.to_string())
    }

    #[no_mangle]
    pub extern "C" fn gc_fnv1a64(p: *mut u8, n: usize) -> *mut u8 {
        let s = take(p, n);
        give(crate::hash::hex64(crate::hash::fnv1a64(s.as_bytes())))
    }

    /// 返回引擎句柄（>0）；失败返回 0，错误信息用 `gc_last_error` 取。
    #[no_mangle]
    pub extern "C" fn gc_new(cp: *mut u8, cn: usize, kp: *mut u8, kn: usize, gp: *mut u8, gn: usize, seed: u64) -> *mut Core {
        let (c, k, g) = (take(cp, cn), take(kp, kn), take(gp, gn));
        let r = (|| -> Result<Core, String> {
            let c = parse(&c, "chapter")?;
            let k = parse(&k, "card")?;
            let g = parse(&g, "config")?;
            Core::new(&c, &k, &g, seed).map_err(|e| e.0)
        })();
        match r {
            Ok(e) => Box::into_raw(Box::new(e)),
            Err(m) => {
                LAST.with(|l| *l.borrow_mut() = m);
                std::ptr::null_mut()
            }
        }
    }

    thread_local! { static LAST: std::cell::RefCell<String> = std::cell::RefCell::new(String::new()); }

    #[no_mangle]
    pub extern "C" fn gc_last_error() -> *mut u8 {
        give(LAST.with(|l| l.borrow().clone()))
    }

    #[no_mangle]
    pub extern "C" fn gc_drop(e: *mut Core) {
        if !e.is_null() {
            unsafe { drop(Box::from_raw(e)) }
        }
    }

    fn eng<'a>(e: *mut Core) -> &'a mut Core {
        unsafe { &mut *e }
    }

    #[no_mangle]
    pub extern "C" fn gc_step(e: *mut Core, p: *mut u8, n: usize) -> *mut u8 {
        let s = take(p, n);
        match parse(&s, "event") {
            Ok(ev) => match eng(e).step(&ev) {
                Ok(v) => give(v.to_string()),
                Err(x) => fail(x.0),
            },
            Err(m) => fail(m),
        }
    }

    #[no_mangle]
    pub extern "C" fn gc_state_json(e: *mut Core) -> *mut u8 {
        give(eng(e).state_json())
    }
    #[no_mangle]
    pub extern "C" fn gc_state_hash(e: *mut Core) -> *mut u8 {
        give(eng(e).state_hash())
    }
    #[no_mangle]
    pub extern "C" fn gc_budget_json(e: *mut Core) -> *mut u8 {
        give(eng(e).budget_json())
    }
    #[no_mangle]
    pub extern "C" fn gc_visible_json(e: *mut Core) -> *mut u8 {
        give(serde_json::to_string(&eng(e).visible()).unwrap_or_else(|_| "[]".into()))
    }
    #[no_mangle]
    pub extern "C" fn gc_snapshot(e: *mut Core) -> *mut u8 {
        match eng(e).snapshot() {
            Ok(s) => give(s),
            Err(x) => fail(x.0),
        }
    }
    /// 成功返回 `{"ok":true}`。
    #[no_mangle]
    pub extern "C" fn gc_restore(e: *mut Core, p: *mut u8, n: usize) -> *mut u8 {
        let s = take(p, n);
        match eng(e).restore(&s) {
            Ok(()) => give(r#"{"ok":true}"#.into()),
            Err(x) => fail(x.0),
        }
    }
    #[no_mangle]
    pub extern "C" fn gc_agm_recall(e: *mut Core, sp: *mut u8, sn: usize, xp: *mut u8, xn: usize, k: usize) -> *mut u8 {
        let (s, x) = (take(sp, sn), take(xp, xn));
        let seeds: Vec<Seed> = match serde_json::from_str(&s) {
            Ok(v) => v,
            Err(m) => return fail(format!("seeds：{m}")),
        };
        let ex: Vec<String> = match serde_json::from_str(&x) {
            Ok(v) => v,
            Err(m) => return fail(format!("exclude：{m}")),
        };
        give(eng(e).agm_recall(&seeds, &ex, k).to_string())
    }
}
