//! 确定性引擎：`step(state, event) → (state', ops[], verdicts[])`（PLAN §4.1）。
//!
//! 规矩：
//! - 不读时钟、不读文件、不联网、不回调 Python。一切不确定输入都先由 Python 记成事件再喂进来。
//! - 状态里只有整数和字符串，没有浮点数；`state_hash` = FNV-1a64(规范化 JSON)。
//! - AI 回合是事务：`turn_begin` 在草稿态上试算，`turn_commit` 一次提交，`turn_abort` 丢弃（PLAN §5.2）。
//!   这三个本身也是事件，所以回放日志就是把事件按序再喂一遍。

use crate::agm::{Agm, Seed, Visible};
use crate::hash::{fnv1a64, hex64, Pcg32};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub const ENGINE_VERSION: &str = "0.1.0";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Wait {
    /// 还没开始 / 刚执行完非阻塞 OP
    Ready,
    /// 刚上屏一句，等玩家点击
    Say,
    /// 停在选项点（pc 指向 CHOICE）
    Choice,
    /// 本章结束
    End,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineageInfo {
    pub parent: Option<String>,
    /// 从父线分叉时父线的回合号
    pub fork_turn: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct State {
    pub seq: u64,
    pub turn: u64,
    pub pc: usize,
    pub wait: Wait,
    pub mode: String, // choice | ai
    pub beat_id: String,
    pub scene: String,
    // ---- 角色状态（PLAN §8.1）
    pub affection: i64,
    pub inner: i64,
    pub deferred: i64, // 傲娇缓冲：延迟到换场结算的正向好感
    pub mood: i64,
    pub tails_script: u32,
    pub tails_ai: u32,
    pub address_stage: u32,
    pub wound: String, // none | angry | dead | reconciled
    pub sprite: Option<String>,
    pub flags: BTreeMap<String, String>,
    // ---- 当前选项点的 AI 插曲
    pub ai_rounds: u32,
    pub excursion_net: i64,
    pub input_closed: bool,
    pub forced_choice_scene: bool,
    pub history: Vec<String>,
    pub ending: Option<String>,
    // ---- 时间线（PLAN §13.3）
    pub lineage: String,
    pub lineages: BTreeMap<String, LineageInfo>,
    pub rng: Pcg32,
    pub in_turn: bool,
    pub turn_says: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Snapshot {
    engine_version: String,
    content_hash: String,
    state: State,
    agm: Agm,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default = "d_threshold")]
    pub intent_threshold_milli: i64,
    /// §8.3 待议：尾鳍须"心里与嘴上落差"支撑。默认关（退回 v1.1 规则）。
    #[serde(default)]
    pub honesty_gap_rule: bool,
    #[serde(default = "d_gap")]
    pub honesty_gap: i64,
    /// 傲娇缓冲：AI 正向好感延迟到换场结算的百分比
    #[serde(default = "d_defer")]
    pub tsundere_defer_pct: i64,
    #[serde(default = "d_mode")]
    pub mode: String,
}
fn d_threshold() -> i64 { 750 }
fn d_gap() -> i64 { 2 }
fn d_defer() -> i64 { 40 }
fn d_mode() -> String { "choice".into() }

pub struct Engine {
    program: Vec<Value>,
    rules: Value,
    rem: BTreeMap<usize, (i64, i64)>,
    content_hash: String,
    signals: BTreeMap<String, String>, // id -> meaning
    sprites: Vec<String>,
    cfg: Config,
    pub state: State,
    draft: Option<State>,
    pub agm: Agm,
}

#[derive(Debug)]
pub struct EngineError(pub String);

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

fn err<T>(m: impl Into<String>) -> Result<T, EngineError> {
    Err(EngineError(m.into()))
}

fn i(v: &Value, k: &str) -> i64 {
    v.get(k).and_then(Value::as_i64).unwrap_or(0)
}

fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("")
}

fn verdict(result: &str, rule: &str, applied: Value, reason: &str) -> Value {
    json!({"result": result, "rule": rule, "applied": applied, "reason": reason})
}

impl Engine {
    pub fn new(chapter: &Value, card: &Value, config: &Value, seed: u64) -> Result<Self, EngineError> {
        let program = chapter.get("program").and_then(Value::as_array).cloned().ok_or(EngineError("chapter 缺少 program".into()))?;
        if program.is_empty() {
            return err("program 为空");
        }
        let mut rem = BTreeMap::new();
        if let Some(r) = chapter.pointer("/analysis/rem").and_then(Value::as_object) {
            for (k, v) in r {
                let pc: usize = k.parse().map_err(|_| EngineError(format!("rem 键不是 pc：{k}")))?;
                rem.insert(pc, (v[0].as_i64().unwrap_or(0), v[1].as_i64().unwrap_or(0)));
            }
        }
        let mut signals = BTreeMap::new();
        for sgl in card.get("honesty_signals").and_then(Value::as_array).into_iter().flatten() {
            signals.insert(s(sgl, "id").to_string(), s(sgl, "meaning").to_string());
        }
        if signals.is_empty() {
            return err("角色卡没有 honesty_signals");
        }
        let sprites = card
            .pointer("/assets/sprites")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
            .unwrap_or_default();
        let cfg: Config = serde_json::from_value(config.clone()).map_err(|e| EngineError(format!("config：{e}")))?;
        let mut lineages = BTreeMap::new();
        lineages.insert("L0".to_string(), LineageInfo { parent: None, fork_turn: 0 });
        let state = State {
            seq: 0,
            turn: 0,
            pc: 0,
            wait: Wait::Ready,
            mode: cfg.mode.clone(),
            beat_id: String::new(),
            scene: String::new(),
            affection: 0,
            inner: 0,
            deferred: 0,
            mood: 0,
            tails_script: 0,
            tails_ai: 0,
            address_stage: 0,
            wound: "none".into(),
            sprite: None,
            flags: BTreeMap::new(),
            ai_rounds: 0,
            excursion_net: 0,
            input_closed: false,
            forced_choice_scene: false,
            history: vec![],
            ending: None,
            lineage: "L0".into(),
            lineages,
            rng: Pcg32::new(seed),
            in_turn: false,
            turn_says: 0,
        };
        Ok(Engine {
            program,
            rules: chapter.get("rules").cloned().unwrap_or(json!({})),
            rem,
            content_hash: s(chapter, "content_hash").to_string(),
            signals,
            sprites,
            cfg,
            state,
            draft: None,
            agm: Agm::default(),
        })
    }

    fn rule(&self, k: &str, d: i64) -> i64 {
        self.rules.get(k).and_then(Value::as_i64).unwrap_or(d)
    }

    fn range(&self) -> (i64, i64) {
        let r = self.rules.get("affection_range");
        (
            r.and_then(|x| x.get(0)).and_then(Value::as_i64).unwrap_or(-100),
            r.and_then(|x| x.get(1)).and_then(Value::as_i64).unwrap_or(100),
        )
    }

    pub fn state_json(&self) -> String {
        serde_json::to_string(&self.state).expect("state 可序列化")
    }

    pub fn state_hash(&self) -> String {
        hex64(fnv1a64(self.state_json().as_bytes()))
    }

    /// 显示用状态（推给前端；好感数字是否显示由前端设置决定）
    fn display_state(&self) -> Value {
        let st = self.draft.as_ref().unwrap_or(&self.state);
        json!({"op": "STATE", "affection": st.affection + st.deferred, "tails": st.tails_script + st.tails_ai,
               "mood": st.mood, "address_stage": st.address_stage, "wound": st.wound,
               "mode": st.mode, "input_open": self.input_open(st), "lineage": st.lineage, "turn": st.turn,
               "wait": st.wait})
    }

    fn input_open(&self, st: &State) -> bool {
        st.wait == Wait::Choice && st.mode == "ai" && !st.input_closed && !st.forced_choice_scene
    }

    // ------------------------------------------------------------------ 剧本 VM
    /// 从 pc 往下执行，直到上屏一句、停在选项或结束。
    fn run(&mut self, ops: &mut Vec<Value>) -> Result<(), EngineError> {
        let mut guard = 0;
        loop {
            guard += 1;
            if guard > 10_000 {
                return err("VM 死循环");
            }
            let pc = self.state.pc;
            let op = self.program.get(pc).cloned().ok_or(EngineError(format!("pc 越界：{pc}")))?;
            let kind = s(&op, "op").to_string();
            match kind.as_str() {
                "SAY" => {
                    ops.push(op);
                    self.state.pc += 1;
                    self.state.wait = Wait::Say;
                    return Ok(());
                }
                "CHOICE" => {
                    self.state.wait = Wait::Choice;
                    self.state.ai_rounds = 0;
                    self.state.excursion_net = 0;
                    self.state.input_closed = false;
                    let mut o = op.clone();
                    // 选项目标 pc 不下发给前端
                    if let Some(arr) = o.get_mut("options").and_then(Value::as_array_mut) {
                        for x in arr {
                            if let Some(m) = x.as_object_mut() {
                                m.remove("target");
                            }
                        }
                    }
                    ops.push(o);
                    return Ok(());
                }
                "END" => {
                    self.state.wait = Wait::End;
                    self.state.ending = Some(s(&op, "ending_id").to_string());
                    ops.push(op);
                    return Ok(());
                }
                "JUMP" => {
                    self.state.pc = i(&op, "target") as usize;
                }
                "MERGE" => {
                    self.state.pc += 1;
                }
                "BEAT" => {
                    self.state.beat_id = s(&op, "beat_id").to_string();
                    self.state.pc += 1;
                }
                "SCENE" => {
                    // 换场：结算傲娇缓冲、心情回落一格、解除本场强制纯选项（PLAN §5.4 L4）
                    self.state.affection += self.state.deferred;
                    self.state.deferred = 0;
                    self.state.mood -= self.state.mood.signum();
                    self.state.forced_choice_scene = false;
                    self.state.scene = s(&op, "id").to_string();
                    ops.push(op);
                    self.state.pc += 1;
                }
                "AFFECT" => {
                    self.state.affection += i(&op, "surface");
                    self.state.inner += op.get("inner").and_then(Value::as_i64).unwrap_or(i(&op, "surface"));
                    ops.push(op);
                    self.state.pc += 1;
                }
                "TAIL" => {
                    self.state.tails_script += 1;
                    ops.push(op);
                    self.state.pc += 1;
                }
                "SPRITE" => {
                    self.state.sprite = op.get("expr").and_then(Value::as_str).map(String::from);
                    ops.push(op);
                    self.state.pc += 1;
                }
                "FLAG" => {
                    self.state.flags.insert(s(&op, "key").into(), s(&op, "value").into());
                    self.state.pc += 1;
                }
                "CALL" => {
                    self.state.address_stage += 1;
                    ops.push(op);
                    self.state.pc += 1;
                }
                _ => {
                    // BGM / SFX / CG / SAVEPOINT / FRAGMENT …：只渲染
                    ops.push(op);
                    self.state.pc += 1;
                }
            }
        }
    }

    fn choice_option(&self, option_id: &str) -> Result<Value, EngineError> {
        let op = &self.program[self.state.pc];
        op.get("options")
            .and_then(Value::as_array)
            .and_then(|a| a.iter().find(|o| s(o, "id") == option_id))
            .cloned()
            .ok_or(EngineError(format!("当前选项点没有 {option_id}")))
    }

    fn take_option(&mut self, option_id: &str, ops: &mut Vec<Value>) -> Result<(), EngineError> {
        let o = self.choice_option(option_id)?;
        self.state.history.push(option_id.to_string());
        self.state.pc = i(&o, "target") as usize;
        self.state.wait = Wait::Ready;
        self.state.ai_rounds = 0;
        self.state.excursion_net = 0;
        self.state.input_closed = false;
        self.run(ops)
    }

    // ------------------------------------------------------------------ 裁决（PLAN §4.3、§8）
    fn budget_for(&self, st: &State) -> Value {
        let (lo, hi) = self.range();
        let (rmin, rmax) = self.rem.get(&st.pc).cloned().unwrap_or((0, 0));
        let cur = st.affection + st.deferred;
        let net = self.rule("excursion_net_max", 3);
        let step = self.rule("step_clamp", 5);
        let up = (hi - rmax - cur).min(net - st.excursion_net).min(step).max(0);
        let down = (cur + rmin - lo).min(net + st.excursion_net).min(step).max(0);
        json!({"affection": cur, "range": [lo, hi], "rem_min": rmin, "rem_max": rmax,
               "room_up": up, "room_down": down, "excursion_net": st.excursion_net,
               "ai_tails_left": (self.rule("ai_tail_max", 1) - st.tails_ai as i64).max(0)
                   .min((self.rule("tail_total_max", 5) - (st.tails_script + st.tails_ai) as i64).max(0)),
               "ai_rounds": st.ai_rounds, "ai_rounds_max": self.rule("ai_rounds_max", 3)})
    }

    pub fn budget_json(&self) -> String {
        let st = self.draft.as_ref().unwrap_or(&self.state);
        self.budget_for(st).to_string()
    }

    fn adjudicate(&mut self, tool: &str, args: &Value, ops: &mut Vec<Value>) -> Value {
        let ai_tail_max = self.rule("ai_tail_max", 1) as u32;
        let tail_total_max = self.rule("tail_total_max", 5) as u32;
        let budget = {
            let st = self.draft.as_ref().expect("回合内");
            self.budget_for(st)
        };
        let signals = self.signals.clone();
        let sprites = self.sprites.clone();
        let cfg = self.cfg.clone();
        let st = self.draft.as_mut().expect("回合内");
        match tool {
            "say" => {
                st.turn_says += 1;
                if st.turn_says > 8 {
                    return verdict("rejected", "turn_say_limit", Value::Null, "一轮最多 8 句");
                }
                // 文本合规由 Python 文本守卫先裁（text_verdict 事件）；能走到这里的句子都已放行
                ops.push(json!({"op": "SAY", "speaker": "heroine", "text": s(args, "text"), "layer": "line",
                                "origin": args.get("origin").and_then(Value::as_str).unwrap_or("improvised"),
                                "voice": Value::Null}));
                verdict("applied", "", Value::Null, "")
            }
            "propose_affection" => {
                let want = i(args, "surface");
                let up = budget["room_up"].as_i64().unwrap_or(0);
                let down = budget["room_down"].as_i64().unwrap_or(0);
                let got = want.clamp(-down, up);
                let inner_want = args.get("inner").and_then(Value::as_i64).unwrap_or(want);
                let inner_got = inner_want.clamp(-5, 5);
                // 傲娇缓冲：正向的一部分延迟到换场
                let (now, later) = if got > 0 {
                    let later = got * cfg.tsundere_defer_pct / 100;
                    (got - later, later)
                } else {
                    (got, 0)
                };
                st.affection += now;
                st.deferred += later;
                st.inner += inner_got;
                st.excursion_net += got;
                let applied = json!({"surface": got, "inner": inner_got, "now": now, "deferred": later});
                if got != want || inner_got != inner_want {
                    let rule = if got.abs() == 5 && want.abs() > 5 { "step_clamp" } else { "chapter_budget" };
                    verdict("clamped", rule, applied, "好感预算 / 单步限幅（PLAN §8.2）")
                } else {
                    verdict("applied", "", applied, "")
                }
            }
            "honesty_signal" => {
                let id = s(args, "signal_id");
                let Some(meaning) = signals.get(id) else {
                    return verdict("rejected", "unknown_signal", Value::Null, "signal_id 不在卡表里");
                };
                if st.tails_ai >= ai_tail_max {
                    return verdict("rejected", "ai_tail_max", Value::Null, "本章 AI 尾鳍次数已用完");
                }
                if st.tails_script + st.tails_ai >= tail_total_max {
                    return verdict("rejected", "tail_total_max", Value::Null, "本章尾鳍出卖总数已到上限");
                }
                if cfg.honesty_gap_rule {
                    let gap = st.inner - st.affection;
                    let ok = match meaning.as_str() {
                        "heart" => gap >= cfg.honesty_gap,
                        "angry" => gap <= -cfg.honesty_gap,
                        _ => gap.abs() >= cfg.honesty_gap,
                    };
                    if !ok {
                        return verdict("rejected", "honesty_gap", json!({"gap": gap}), "心里与嘴上的落差撑不起这个信号");
                    }
                }
                st.tails_ai += 1;
                let noticed = args.get("noticed").and_then(Value::as_bool).unwrap_or(false);
                ops.push(json!({"op": "TAIL", "signal_id": id, "count": 1, "desc": s(args, "action"),
                                "noticed": noticed, "source": "ai", "meaning": meaning}));
                verdict("applied", "", json!({"signal_id": id, "noticed": noticed}), "")
            }
            "propose_mood" => {
                let want = i(args, "delta");
                let got = want.clamp(-2, 2);
                let before = st.mood;
                st.mood = (st.mood + got).clamp(-5, 5);
                let applied = json!({"delta": st.mood - before});
                if st.mood - before != want {
                    verdict("clamped", "mood_clamp", applied, "心情单步 ±2、范围 ±5")
                } else {
                    verdict("applied", "", applied, "")
                }
            }
            "set_sprite" => {
                let e = s(args, "expr");
                if !sprites.is_empty() && !sprites.iter().any(|x| x == e) {
                    return verdict("rejected", "unknown_sprite", Value::Null, "差分不在卡的立绘清单里");
                }
                st.sprite = Some(e.to_string());
                ops.push(json!({"op": "SPRITE", "card": "heroine", "expr": e, "pos": "center", "kind": "static"}));
                verdict("applied", "", Value::Null, "")
            }
            "propose_branch" => verdict("rejected", "demo_branch_closed", Value::Null, "新分支只记录，Demo 不开放演出（PLAN §9.2）"),
            "request_ending" => verdict("rejected", "director_only", Value::Null, "结局只能由导演宣布（PLAN §9.2）"),
            "taboo_event" => verdict("rejected", "taboo_director_only", Value::Null, "逆鳞只能由导演按剧本授权触发（PLAN §8.4）"),
            "write_memory" | "write_diary" | "play_sfx" | "recall_memory" => verdict("applied", "", Value::Null, ""),
            "generate_image" | "speak" | "propose_music_mood" => verdict("rejected", "reserved", Value::Null, "接口预留，Demo 未启用"),
            other => verdict("rejected", "unknown_tool", Value::Null, &format!("未知工具：{other}")),
        }
    }

    // ------------------------------------------------------------------ 事件入口
    pub fn step(&mut self, event: &Value) -> Result<Value, EngineError> {
        let kind = s(event, "kind").to_string();
        let p = event.get("payload").cloned().unwrap_or(json!({}));
        let mut ops: Vec<Value> = vec![];
        let mut verdicts: Vec<Value> = vec![];
        if self.state.in_turn && !matches!(kind.as_str(), "model_tool_call" | "turn_commit" | "turn_abort" | "text_verdict" | "memory_recall" | "memory_write" | "fallback" | "perform") {
            return err(format!("AI 回合进行中，不能处理 {kind}"));
        }
        match kind.as_str() {
            "advance" => match self.state.wait {
                Wait::Ready | Wait::Say => self.run(&mut ops)?,
                Wait::Choice => return err("停在选项点，不能 advance"),
                Wait::End => return err("本章已结束"),
            },
            "choice" => {
                if self.state.wait != Wait::Choice {
                    return err("不在选项点");
                }
                self.state.turn += 1;
                self.take_option(s(&p, "option_id"), &mut ops)?;
            }
            "player_input" => {
                if self.state.wait != Wait::Choice {
                    return err("输入框只在选项点开放（v1.3）");
                }
                if !self.input_open(&self.state) {
                    verdicts.push(verdict("rejected", "input_closed", Value::Null, "本选项点输入已关闭或处于纯选项模式"));
                } else {
                    self.state.turn += 1;
                }
            }
            "intent" => {
                // 意图分类结果（Python 记录的模型输出）。命中原选项且置信度够 → 按原选项走
                let conf = i(&p, "confidence_milli");
                let matched = s(&p, "matched_option").to_string();
                if !matched.is_empty() && conf >= self.cfg.intent_threshold_milli && self.state.wait == Wait::Choice {
                    if self.choice_option(&matched).is_ok() {
                        verdicts.push(verdict("applied", "intent_matched", json!({"option_id": matched}), ""));
                        self.take_option(&matched, &mut ops)?;
                    } else {
                        verdicts.push(verdict("rejected", "unknown_option", Value::Null, "匹配到的选项不存在"));
                    }
                } else {
                    verdicts.push(verdict("applied", "off_script", json!({"intent": s(&p, "intent")}), ""));
                }
            }
            "turn_begin" => {
                if self.state.wait != Wait::Choice {
                    return err("AI 回合只能在选项点开始");
                }
                if !self.input_open(&self.state) {
                    return err("本选项点 AI 回合已用尽或处于纯选项模式");
                }
                let mut d = self.state.clone();
                d.in_turn = true;
                d.turn_says = 0;
                d.ai_rounds += 1;
                self.state.in_turn = true;
                self.draft = Some(d);
            }
            "model_tool_call" => {
                if self.draft.is_none() {
                    return err("model_tool_call 必须在 turn_begin 之后");
                }
                let tool = s(&p, "tool").to_string();
                let args = p.get("args").cloned().unwrap_or(json!({}));
                let v = self.adjudicate(&tool, &args, &mut ops);
                verdicts.push(v);
            }
            "turn_commit" => {
                let Some(mut d) = self.draft.take() else { return err("没有进行中的回合") };
                d.in_turn = false;
                d.turn_says = 0;
                let max = self.rule("ai_rounds_max", 3) as u32;
                if d.ai_rounds >= max {
                    d.input_closed = true; // 导演引回：本选项点只能点选项了（PLAN §9.2）
                    verdicts.push(verdict("applied", "steer_back", json!({"ai_rounds": d.ai_rounds}), "即兴轮数用尽，引回选项"));
                }
                self.state = d;
            }
            "turn_abort" => {
                if self.draft.take().is_none() {
                    return err("没有进行中的回合");
                }
                self.state.in_turn = false;
                self.state.ai_rounds += 1; // 失败的一轮也算轮数
                let max = self.rule("ai_rounds_max", 3) as u32;
                if self.state.ai_rounds >= max {
                    self.state.input_closed = true;
                }
            }
            "director" => match s(&p, "action") {
                "steer_back" => {
                    self.state.input_closed = true;
                    verdicts.push(verdict("applied", "steer_back", Value::Null, ""));
                }
                "taboo_event" => {
                    let authorized = self.state.flags.get("taboo_authorized").map(|v| v == "1").unwrap_or(false);
                    let used = self.state.flags.contains_key("taboo_used");
                    if authorized && !used {
                        self.state.flags.insert("taboo_used".into(), "1".into());
                        verdicts.push(verdict("applied", "", Value::Null, ""));
                    } else {
                        verdicts.push(verdict("rejected", "taboo_not_authorized", Value::Null, "剧本未授权或本季已用过（PLAN §8.4）"));
                    }
                }
                other => verdicts.push(verdict("rejected", "unknown_director_action", Value::Null, other)),
            },
            "mode_switch" => {
                let m = s(&p, "mode");
                if m != "choice" && m != "ai" {
                    return err("mode 只能是 choice 或 ai");
                }
                self.state.mode = m.to_string();
            }
            "fallback" => {
                if i(&p, "level") >= 4 {
                    self.state.forced_choice_scene = true; // L4：本场退回纯选项
                }
                if let Some(d) = self.draft.as_mut() {
                    if i(&p, "level") >= 4 {
                        d.forced_choice_scene = true;
                    }
                }
            }
            "memory_write" => {
                // 共现进 AGM 图（PLAN §13.1）；边带当前时间线与回合
                let items: Vec<String> = p.get("cooccur").and_then(Value::as_array).into_iter().flatten()
                    .filter_map(|x| x.as_str().map(String::from)).collect();
                let (lin, turn) = (self.state.lineage.clone(), self.state.turn);
                self.agm.observe(&items, &lin, turn);
            }
            "load" => {
                let snap: Snapshot = serde_json::from_value(p.get("snapshot").cloned().unwrap_or(Value::Null))
                    .map_err(|e| EngineError(format!("快照损坏：{e}")))?;
                if snap.content_hash != self.content_hash {
                    return err("快照的 content_hash 与当前剧本不一致（Demo 不做存档迁移）");
                }
                let new_lin = s(&p, "new_lineage").to_string();
                let parent = snap.state.lineage.clone();
                let fork = snap.state.turn;
                let mut lineages = self.state.lineages.clone();
                if lineages.contains_key(&new_lin) || new_lin.is_empty() {
                    return err(format!("非法的新时间线：{new_lin}"));
                }
                lineages.insert(new_lin.clone(), LineageInfo { parent: Some(parent), fork_turn: fork });
                let seq = self.state.seq;
                self.state = snap.state;
                self.state.lineages = lineages;
                self.state.lineage = new_lin;
                self.state.seq = seq;
                // AGM 图不回滚：被放弃时间线的边按可见性隐藏
                ops.push(json!({"op": "RESTORE"}));
                if self.state.wait == Wait::Choice {
                    let op = self.program[self.state.pc].clone();
                    let mut o = op;
                    if let Some(arr) = o.get_mut("options").and_then(Value::as_array_mut) {
                        for x in arr { if let Some(m) = x.as_object_mut() { m.remove("target"); } }
                    }
                    ops.push(o);
                }
            }
            // 只记录、不改状态的事件（结论已在 Python 侧裁过，记下来供回放与时间轴）
            "text_verdict" | "memory_recall" | "save" | "perform" | "diary_view" => {}
            other => return err(format!("未知事件：{other}")),
        }
        self.state.seq += 1;
        if let Some(d) = self.draft.as_mut() {
            d.seq = self.state.seq;
        }
        ops.push(self.display_state());
        Ok(json!({"ops": ops, "verdicts": verdicts, "state_hash": self.state_hash(), "seq": self.state.seq}))
    }

    // ------------------------------------------------------------------ 快照 / 时间线 / AGM
    pub fn snapshot(&self) -> Result<String, EngineError> {
        if self.state.in_turn {
            return err("AI 回合进行中不能存档");
        }
        let s = Snapshot { engine_version: ENGINE_VERSION.into(), content_hash: self.content_hash.clone(),
                           state: self.state.clone(), agm: self.agm.clone() };
        Ok(serde_json::to_string(&s).unwrap())
    }

    /// 整体恢复（用于调试时间轴拖动：从快照直接恢复，不开新时间线）。
    pub fn restore(&mut self, snap: &str) -> Result<(), EngineError> {
        let s: Snapshot = serde_json::from_str(snap).map_err(|e| EngineError(format!("快照损坏：{e}")))?;
        if s.content_hash != self.content_hash {
            return err("content_hash 不一致");
        }
        self.state = s.state;
        self.agm = s.agm;
        self.draft = None;
        Ok(())
    }

    /// 当前可见的时间线前缀：本线全部 + 祖先线到各自分叉点（PLAN §13.3）。
    pub fn visible(&self) -> Vec<Visible> {
        let mut out = vec![Visible { lineage: self.state.lineage.clone(), max_turn: u64::MAX }];
        let mut cur = self.state.lineage.clone();
        while let Some(info) = self.state.lineages.get(&cur) {
            match &info.parent {
                Some(p) => {
                    let m = out.last().map(|v| v.max_turn).unwrap_or(u64::MAX).min(info.fork_turn);
                    out.push(Visible { lineage: p.clone(), max_turn: m });
                    cur = p.clone();
                }
                None => break,
            }
        }
        out
    }

    pub fn agm_recall(&self, seeds: &[Seed], exclude: &[String], k: usize) -> Value {
        let vis = self.visible();
        serde_json::to_value(self.agm.recall(seeds, exclude, k, &vis)).unwrap()
    }
}
