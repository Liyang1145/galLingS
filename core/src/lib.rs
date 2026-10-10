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
