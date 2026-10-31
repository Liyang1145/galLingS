//! Optional native file-record transport (Windows/Linux). One worker, one page head, one cached receipt.
use super::{PAGE_READY, PAGE_SEQUENCE, STOP_HEARTBEAT};
use crate::rebuild_storage::{ExchangeResult, NativeRecordStore, StorageError};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::sync::{mpsc, Arc};
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{Manager, WebviewWindow};

const MAX_ID: u64 = 9_007_199_254_740_991;
const MAX_REQUEST: usize = 3 * 1024 * 1024;
const PAGE_BYTES: usize = 3 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    format: String,
    owner: String,
    id: u64,
    #[serde(rename = "workId")]
    work_id: String,
    operation: Box<RawValue>,
}
enum Operation {
    Read { key: String },
    Scan { prefix: String, after: Option<String>, limit: usize },
    Replace { key: String, value: Box<RawValue> },
    Cas { key: String, expected: u64, value: Box<RawValue> },
}
// Deserialize each operation directly from raw JSON; tagged-enum buffering would lose RawValue.
fn operation(raw: &RawValue) -> Result<Operation, serde_json::Error> {
    #[derive(Deserialize)]
    struct Kind { op: String }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Read { #[serde(rename = "op")] _op: String, key: String }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Scan { #[serde(rename = "op")] _op: String, prefix: String, after: Option<String>, limit: usize }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Replace { #[serde(rename = "op")] _op: String, key: String, value: Box<RawValue> }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Cas { #[serde(rename = "op")] _op: String, key: String, expected: u64, value: Box<RawValue> }
    let kind: Kind = serde_json::from_str(raw.get())?;
    match kind.op.as_str() {
        "read" => { let input: Read = serde_json::from_str(raw.get())?; Ok(Operation::Read { key: input.key }) }
        "scan" => { let input: Scan = serde_json::from_str(raw.get())?; Ok(Operation::Scan { prefix: input.prefix, after: input.after, limit: input.limit }) }
        "replace" => { let input: Replace = serde_json::from_str(raw.get())?; Ok(Operation::Replace { key: input.key, value: input.value }) }
        "cas" => { let input: Cas = serde_json::from_str(raw.get())?; Ok(Operation::Cas { key: input.key, expected: input.expected, value: input.value }) }
        _ => Err(<serde_json::Error as serde::de::Error>::custom("未知原生记录操作")),
    }
}
#[derive(Serialize)]
#[serde(untagged)]
enum Slot {
    Missing { found: bool },
    Found { found: bool, value: Box<RawValue> },
}
#[derive(Serialize)]
struct Row { key: String, value: Box<RawValue> }
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Outcome {
    Read { revision: u64, slot: Slot },
    Scan { revision: u64, entries: Vec<Row>, next: Option<String> },
    Committed { revision: u64 },
    Conflict { revision: u64 },
}
#[derive(Serialize)]
struct Failure { code: String, message: String }
#[derive(Serialize)]
#[serde(untagged)]
enum Payload {
    Success { ok: bool, result: Outcome },
    Failed { ok: bool, error: Failure },
}
#[derive(Serialize)]
struct Reply {
    format: &'static str,
    owner: String,
    id: u64,
    warnings: Vec<String>,
    #[serde(flatten)]
    payload: Payload,
}
struct Receipt {
    page: u64,
    owner: String,
    id: u64,
    request: String,
    reply: Reply,
}

fn compact(messages: Vec<String>) -> Vec<String> {
    let count = messages.len();
    let mut output: Vec<_> = messages.into_iter().take(15)
        .map(|message| message.chars().take(512).collect::<String>()).collect();
    if count > 15 { output.push(format!("另外 {} 条旧容器/临时文件警告；当前提交结果不因此改变", count - 15)); }
    output
}
fn failed(owner: String, id: u64, code: &str, message: &str) -> Reply {
    Reply {
        format: "haifeng.native-record-reply/1", owner, id, warnings: Vec::new(),
        payload: Payload::Failed {
            ok: false, error: Failure { code: code.into(), message: message.chars().take(1024).collect() },
        },
    }
}
fn execute(store: &NativeRecordStore, operation: Operation) -> Result<(Outcome, Vec<String>), StorageError> {
    match operation {
        Operation::Read { key } => {
            let read = store.read(&key)?;
            let slot = match read.value { Some(value) => Slot::Found { found: true, value }, None => Slot::Missing { found: false } };
            Ok((Outcome::Read { revision: read.revision, slot }, read.warnings))
        }
        Operation::Scan { prefix, after, limit } => {
            let page = store.scan(&prefix, after.as_deref(), limit)?;
            let mut entries = Vec::new();
            let mut bytes = 1024;
            let mut shortened = false;
            for (key, value) in page.entries {
                let size = key.len() * 2 + value.get().len() + 64;
                if !entries.is_empty() && bytes + size > PAGE_BYTES { shortened = true; break; }
                bytes += size;
                entries.push(Row { key, value });
            }
            let next = if shortened { entries.last().map(|row| row.key.clone()) } else { page.next };
            Ok((Outcome::Scan { revision: page.revision, entries, next }, page.warnings))
        }
        Operation::Replace { key, value } => {
            let saved = store.replace_progress(&key, value)?;
            Ok((Outcome::Committed { revision: saved.revision }, saved.warnings))
        }
        Operation::Cas { key, expected, value } => match store.compare_exchange(&key, expected, value)? {
            ExchangeResult::Committed(saved) => Ok((Outcome::Committed { revision: saved.revision }, saved.warnings)),
            ExchangeResult::Conflict { revision, warnings } => Ok((Outcome::Conflict { revision }, warnings)),
        },
    }
}

fn current(page: u64) -> bool {
    !STOP_HEARTBEAT.load(Ordering::SeqCst) && PAGE_READY.load(Ordering::SeqCst)
        && PAGE_SEQUENCE.load(Ordering::SeqCst) == page
}
fn deliver(window: &WebviewWindow, receipt: &Reply, page: u64) {
    if !current(page) { return; }
    // Serialize raw payload directly, then quote the whole JSON text. Never splice a record into JS code.
    let Ok(json) = serde_json::to_string(receipt) else {
        eprintln!("原生记录回执编码未完成；保留原回执，不重新执行操作");
        return;
    };
    if json.len() > MAX_REQUEST + 65536 {
        eprintln!("原生记录回执超过传输上限；保留原回执，不重新执行操作");
        return;
    }
    let Ok(literal) = serde_json::to_string(&json) else { return };
    let origin = super::PAGE_ORIGIN_JS;
    let _ = window.eval(&format!(
        "(() => {{if(window.top!==window||location.origin!=={origin})return;const b=window.__HAIFENG_RECORDS__;if(b?.protocol==='haifeng.native-records/1')b.receive(JSON.parse({literal}));}})()"
    ));
}

pub(super) fn start(app: tauri::AppHandle, store: Arc<NativeRecordStore>, work_id: String) -> std::io::Result<()> {
    std::thread::Builder::new().name("haifeng-native-records".into()).spawn(move || {
        let mut last: Option<Receipt> = None;
        loop {
            std::thread::sleep(Duration::from_millis(100));
            if STOP_HEARTBEAT.load(Ordering::SeqCst) { break; }
            let Some(window) = app.get_webview_window("rebuild") else { break };
            let page = PAGE_SEQUENCE.load(Ordering::SeqCst);
            if !current(page) { continue; }
            if last.as_ref().map(|receipt| receipt.page != page).unwrap_or(false) { last = None; }
            let (sender, receiver) = mpsc::channel();
            let script = format!("(() => {{if(window.top!==window||location.origin!=={})return null;const b=window.__HAIFENG_RECORDS__;return b?.protocol==='haifeng.native-records/1'?b.readRequest():null;}})()", super::PAGE_ORIGIN_JS);
            if window.eval_with_callback(script, move |answer| { let _ = sender.send(answer); }).is_err() {
                continue;
            }
            let answer = match receiver.recv_timeout(Duration::from_secs(1)) {
                Ok(answer) => answer,
                Err(_) => continue,
            };
            if !current(page) { continue; }
            if answer.len() > MAX_REQUEST * 2 + 8 { continue; }
            let Ok(Some(json)) = serde_json::from_str::<Option<String>>(&answer) else {
                continue;
            };
            if json.len() > MAX_REQUEST { continue; }
            let request = match serde_json::from_str::<Request>(&json) {
                Ok(request) => request,
                Err(_) => { eprintln!("原生记录请求格式无效，未执行文件操作"); continue; }
            };
            if request.format != "haifeng.native-record-request/1" || request.work_id != work_id
                || request.id == 0 || request.id > MAX_ID || request.owner.len() != 36
                || !request.owner.bytes().all(|byte| byte.is_ascii_hexdigit() || byte == b'-') { continue; }
            if let Some(receipt) = &last {
                if request.owner != receipt.owner { continue; }
                if request.id <= receipt.id {
                    if request.id == receipt.id && json == receipt.request {
                        deliver(&window, &receipt.reply, page);
                    } else {
                        deliver(&window, &failed(request.owner, request.id, "NATIVE_STORAGE_ID",
                            "请求身份已使用或载荷改变，未重新执行；请确认原记录"), page);
                    }
                    continue;
                }
            }
            // Once this starts, a page change can suppress delivery but cannot undo a disk transaction.
            if !current(page) { continue; }
            let owner = request.owner;
            let id = request.id;
            let parsed = operation(&request.operation).map_err(|error| StorageError {
                code: "NATIVE_STORAGE_REQUEST", message: format!("原生记录操作字段无效：{error}"),
            });
            let reply = match parsed.and_then(|operation| execute(&store, operation)) {
                Ok((result, warnings)) => Reply {
                    format: "haifeng.native-record-reply/1", owner: owner.clone(), id,
                    warnings: compact(warnings), payload: Payload::Success { ok: true, result },
                },
                Err(error) => failed(owner.clone(), id, error.code, &error.message),
            };
            last = Some(Receipt { page, owner, id, request: json, reply });
            if let Some(receipt) = &last { deliver(&window, &receipt.reply, page); }
        }
    }).map(|_| ())
}
