//! Windows integration backend, selected only by the host's explicit file-record trial flag.
//! Each logical record retains its existing TypeScript key/value. No story or merge rules run here.
mod address;

use address::{compare_keys, Addresses};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::fs::{MetadataExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const FORMAT: &str = "haifeng.native-record-table/1";
const MAX_REVISION: u64 = 9_007_199_254_740_991;
const MAX_RECORD_BYTES: usize = 2 * 1024 * 1024;
const MAX_TABLE_BYTES: usize = 32 * 1024 * 1024;
const MAX_RECORDS: usize = 4096;
const MAX_FILES: usize = 4096;
const REPARSE_POINT: u32 = 0x400;
const MOVE_WRITE_THROUGH: u32 = 0x8;
static ATTEMPT: AtomicU64 = AtomicU64::new(0);

#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(existing: *const u16, destination: *const u16, flags: u32) -> i32;
}

#[derive(Debug)]
pub(crate) struct StorageError {
    pub code: &'static str,
    pub message: String,
}
impl std::fmt::Display for StorageError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}：{}", self.code, self.message)
    }
}
impl std::error::Error for StorageError {}
type Result<T> = std::result::Result<T, StorageError>;
fn error(code: &'static str, message: impl Into<String>) -> StorageError {
    StorageError { code, message: message.into() }
}
fn io_error(label: &str, source: std::io::Error) -> StorageError {
    error("NATIVE_STORAGE_IO", format!("{label}：{source}"))
}

#[derive(Default, Serialize)]
#[serde(transparent)]
struct Entries(BTreeMap<String, Box<RawValue>>);
impl<'de> Deserialize<'de> for Entries {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = Entries;
            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("有界、没有重复键的独立记录表")
            }
            fn visit_map<M: serde::de::MapAccess<'de>>(self, mut map: M) -> std::result::Result<Entries, M::Error> {
                let mut entries = BTreeMap::new();
                while let Some((key, value)) = map.next_entry::<String, Box<RawValue>>()? {
                    if entries.len() >= MAX_RECORDS || entries.insert(key, value).is_some() {
                        return Err(serde::de::Error::custom("记录表超出容量或含重复键"));
                    }
                }
                Ok(Entries(entries))
            }
        }
        deserializer.deserialize_map(Visitor)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Table {
    format: String,
    #[serde(rename = "workId")]
    work_id: String,
    revision: u64,
    entries: Entries,
}

struct Layout {
    committed: Vec<(u64, PathBuf)>,
    pending: usize,
}
struct Loaded {
    table: Table,
    layout: Layout,
}

pub(crate) struct ReadResult {
    /// Storage CAS generation only; not a content revision, core step or save-format version.
    pub revision: u64,
    /// None is missing; Some(raw JSON null) is existing. Raw JSON preserves UTF-16 escapes.
    pub value: Option<Box<RawValue>>,
    pub warnings: Vec<String>,
}
pub(crate) struct ScanResult {
    pub revision: u64,
    pub entries: Vec<(String, Box<RawValue>)>,
    pub next: Option<String>,
    pub warnings: Vec<String>,
}
pub(crate) struct CommitResult {
    pub revision: u64,
    pub warnings: Vec<String>,
}
pub(crate) enum ExchangeResult {
    Conflict { revision: u64, warnings: Vec<String> },
    Committed(CommitResult),
}

pub(crate) struct NativeRecordStore {
    root: PathBuf,
    work_id: String,
    addresses: Addresses,
    // No sharing: another backend/process must not open this same integration store concurrently.
    _lease: File,
    serial: Mutex<u64>,
}

impl NativeRecordStore {
    /// Only a trusted native caller may choose the dedicated integration directory and work identity.
    pub(crate) fn open(root: PathBuf, work_id: String) -> Result<Self> {
        let addresses = Addresses::new(&work_id).map_err(|message| error("NATIVE_STORAGE_WORK", message))?;
        match fs::symlink_metadata(&root) {
            Ok(metadata) => {
                if !metadata.is_dir() || metadata.file_attributes() & REPARSE_POINT != 0 {
                    return Err(error("NATIVE_STORAGE_ROOT", "游戏记录根须为独立普通目录"));
                }
            }
            Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir_all(&root).map_err(|source| io_error("无法创建游戏记录目录", source))?;
            }
            Err(source) => return Err(io_error("无法读取游戏记录目录", source)),
        }
        let metadata = fs::symlink_metadata(&root).map_err(|source| io_error("无法确认游戏记录目录", source))?;
        if !metadata.is_dir() || metadata.file_attributes() & REPARSE_POINT != 0 {
            return Err(error("NATIVE_STORAGE_ROOT", "游戏记录根不能是重解析点"));
        }
        let root = fs::canonicalize(root).map_err(|source| io_error("无法定位游戏记录目录", source))?;
        let lock = root.join("store.lock");
        match fs::symlink_metadata(&lock) {
            Ok(metadata) if !metadata.is_file() || metadata.file_attributes() & REPARSE_POINT != 0 => {
                return Err(error("NATIVE_STORAGE_LOCK", "游戏记录锁不是普通文件"));
            }
            Ok(_) => {}
            Err(source) if source.kind() == std::io::ErrorKind::NotFound => {}
            Err(source) => return Err(io_error("无法读取游戏记录锁", source)),
        }
        let lease = OpenOptions::new().read(true).write(true).create(true).share_mode(0).open(lock)
            .map_err(|source| error("NATIVE_STORAGE_LOCK", format!("无法独占游戏记录目录；请关闭使用它的其他宿主后重试：{source}")))?;
        Ok(Self { root, work_id, addresses, _lease: lease, serial: Mutex::new(0) })
    }

    pub(crate) fn read(&self, key: &str) -> Result<ReadResult> {
        self.check_key(key)?;
        let mut serial = self.serial.lock().map_err(|_| error("NATIVE_STORAGE_LOCK", "游戏记录操作已异常，需重开宿主"))?;
        let loaded = self.load()?;
        observe(&mut serial, loaded.table.revision)?;
        Ok(ReadResult {
            revision: loaded.table.revision,
            value: loaded.table.entries.0.get(key).cloned(),
            warnings: warnings(&loaded.layout),
        })
    }

    pub(crate) fn scan(&self, prefix: &str, after: Option<&str>, limit: usize) -> Result<ScanResult> {
        if !self.addresses.is_prefix(prefix) || !(1..=100).contains(&limit)
            || after.map(|key| !key.starts_with(prefix) || !self.addresses.is_progress(key)).unwrap_or(false) {
            return Err(error("NATIVE_STORAGE_PAGE", "目录范围、游标或容量无效"));
        }
        let mut serial = self.serial.lock().map_err(|_| error("NATIVE_STORAGE_LOCK", "游戏记录操作已异常，需重开宿主"))?;
        let loaded = self.load()?;
        observe(&mut serial, loaded.table.revision)?;
        let mut entries: Vec<_> = loaded.table.entries.0.iter().filter(|(key, _)| {
            key.starts_with(prefix) && after.map(|cursor| compare_keys(key, cursor).is_gt()).unwrap_or(true)
        }).collect();
        entries.sort_by(|(left, _), (right, _)| compare_keys(left, right));
        let more = entries.len() > limit;
        let entries: Vec<_> = entries.into_iter().take(limit).map(|(key, value)| (key.clone(), value.clone())).collect();
        let next = if more { entries.last().map(|(key, _)| key.clone()) } else { None };
        Ok(ScanResult { revision: loaded.table.revision, entries, next, warnings: warnings(&loaded.layout) })
    }

    pub(crate) fn replace_progress(&self, key: &str, value: Box<RawValue>) -> Result<CommitResult> {
        if !self.addresses.is_progress(key) { return Err(error("NATIVE_STORAGE_KEY", "此操作仅替换当前游戏进度槽位")); }
        self.check_value(key, &value)?;
        let mut serial = self.serial.lock().map_err(|_| error("NATIVE_STORAGE_LOCK", "游戏记录操作已异常，需重开宿主"))?;
        let mut loaded = self.load()?;
        observe(&mut serial, loaded.table.revision)?;
        loaded.table.entries.0.insert(key.into(), value);
        let committed = self.commit(loaded)?;
        *serial = committed.revision;
        Ok(committed)
    }

    /// Merge/validation stays in TypeScript. A stale storage generation is a conflict, not a write.
    pub(crate) fn compare_exchange(&self, key: &str, expected: u64, value: Box<RawValue>) -> Result<ExchangeResult> {
        if !self.addresses.is_record(key) || expected > MAX_REVISION {
            return Err(error("NATIVE_STORAGE_CAS", "仅已登记的成果/偏好地址可使用有效存储代次更新"));
        }
        self.check_value(key, &value)?;
        let mut serial = self.serial.lock().map_err(|_| error("NATIVE_STORAGE_LOCK", "游戏记录操作已异常，需重开宿主"))?;
        let mut loaded = self.load()?;
        observe(&mut serial, loaded.table.revision)?;
        if expected > loaded.table.revision {
            return Err(error("NATIVE_STORAGE_REVISION", "提交代次低于预期，不能据旧容器覆盖记录"));
        }
        if expected != loaded.table.revision {
            return Ok(ExchangeResult::Conflict { revision: loaded.table.revision, warnings: warnings(&loaded.layout) });
        }
        loaded.table.entries.0.insert(key.into(), value);
        let committed = self.commit(loaded)?;
        *serial = committed.revision;
        Ok(ExchangeResult::Committed(committed))
    }

    fn check_key(&self, key: &str) -> Result<()> {
        if !self.addresses.contains(key) { return Err(error("NATIVE_STORAGE_KEY", "记录地址不属于当前作品的已登记游戏范围")); }
        Ok(())
    }

    fn check_value(&self, key: &str, value: &RawValue) -> Result<()> {
        self.check_key(key)?;
        if !self.addresses.matches_value(key, value) {
            return Err(error("NATIVE_STORAGE_FAMILY", "记录封装与目标地址种类不一致"));
        }
        if value.get().len() > MAX_RECORD_BYTES { return Err(error("NATIVE_STORAGE_CAPACITY", "单条游戏记录超过 2 MiB；未截断或覆盖旧记录")); }
        Ok(())
    }

    fn layout(&self) -> Result<Layout> {
        let mut layout = Layout { committed: Vec::new(), pending: 0 };
        for (index, entry) in fs::read_dir(&self.root).map_err(|source| io_error("无法读取游戏记录目录", source))?.enumerate() {
            if index >= MAX_FILES { return Err(error("NATIVE_STORAGE_CAPACITY", "游戏记录目录文件过多，需保留诊断后处理")); }
            let entry = entry.map_err(|source| io_error("无法读取游戏记录目录项", source))?;
            let name = entry.file_name().into_string().map_err(|_| error("NATIVE_STORAGE_LAYOUT", "游戏记录文件名无效"))?;
            if name == "store.lock" { continue; }
            let metadata = fs::symlink_metadata(entry.path()).map_err(|source| io_error("无法确认游戏记录目录项", source))?;
            if !metadata.is_file() || metadata.file_attributes() & REPARSE_POINT != 0 {
                return Err(error("NATIVE_STORAGE_LAYOUT", "游戏记录目录包含非普通文件；未自动修复"));
            }
            if let Some(revision) = snapshot_revision(&name) {
                layout.committed.push((revision, entry.path()));
            } else if pending_name(&name) {
                layout.pending += 1;
            } else {
                return Err(error("NATIVE_STORAGE_LAYOUT", "游戏记录目录含未知文件，不能按空记录初始化"));
            }
        }
        layout.committed.sort_by_key(|(revision, _)| *revision);
        Ok(layout)
    }

    fn table(&self, path: &Path, revision: u64) -> Result<Table> {
        let file = OpenOptions::new().read(true).share_mode(1).open(path)
            .map_err(|source| io_error("无法读取原生记录容器", source))?;
        let mut bytes = Vec::new();
        file.take((MAX_TABLE_BYTES + 1) as u64).read_to_end(&mut bytes)
            .map_err(|source| io_error("无法完整读取原生记录容器", source))?;
        if bytes.len() > MAX_TABLE_BYTES { return Err(error("NATIVE_STORAGE_CAPACITY", "原生记录容器超过 32 MiB")); }
        let table: Table = serde_json::from_slice(&bytes)
            .map_err(|source| error("NATIVE_STORAGE_CORRUPT", format!("原生记录容器损坏，未回落旧版本：{source}")))?;
        if table.format != FORMAT || table.work_id != self.work_id || table.revision != revision {
            return Err(error("NATIVE_STORAGE_IDENTITY", "原生记录容器格式、作品或提交代次不一致；未覆盖"));
        }
        for (key, value) in &table.entries.0 {
            self.check_key(key)?;
            // Existing corrupt payloads remain readable as opaque values for TypeScript diagnostics.
            if value.get().len() > MAX_RECORD_BYTES {
                return Err(error("NATIVE_STORAGE_CAPACITY", "原生容器中的单条记录超过容量；未截断"));
            }
        }
        Ok(table)
    }

    fn load(&self) -> Result<Loaded> {
        let layout = self.layout()?;
        // Never silently restore an older snapshot when the newest committed one is unreadable.
        let table = if let Some((revision, path)) = layout.committed.last() {
            self.table(path, *revision)?
        } else {
            Table { format: FORMAT.into(), work_id: self.work_id.clone(), revision: 0, entries: Entries::default() }
        };
        Ok(Loaded { table, layout })
    }

    fn commit(&self, mut loaded: Loaded) -> Result<CommitResult> {
        let revision = loaded.table.revision.checked_add(1).filter(|revision| *revision <= MAX_REVISION)
            .ok_or_else(|| error("NATIVE_STORAGE_REVISION", "存储代次已耗尽，未覆盖旧记录"))?;
        if loaded.table.entries.0.len() > MAX_RECORDS {
            return Err(error("NATIVE_STORAGE_CAPACITY", "游戏记录超过 4096 个逻辑地址；未删除旧记录"));
        }
        loaded.table.revision = revision;
        let bytes = serde_json::to_vec(&loaded.table).map_err(|source| error("NATIVE_STORAGE_VALUE", source.to_string()))?;
        if bytes.len() > MAX_TABLE_BYTES { return Err(error("NATIVE_STORAGE_CAPACITY", "游戏记录总量超过 32 MiB；未截断或覆盖旧记录")); }
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH)
            .map_err(|_| error("NATIVE_STORAGE_CLOCK", "无法生成临时文件身份；未采用默认时间"))?.as_nanos();
        let attempt = ATTEMPT.fetch_add(1, Ordering::Relaxed);
        let temporary = self.root.join(format!("pending-{}-{attempt}-{nanos}.tmp", std::process::id()));
        let mut file = OpenOptions::new().write(true).create_new(true).share_mode(0).open(&temporary)
            .map_err(|source| io_error("无法创建独占临时记录文件", source))?;
        file.write_all(&bytes).map_err(|source| io_error("临时记录未完整写入，旧提交保留", source))?;
        file.sync_all().map_err(|source| io_error("临时记录同步失败，旧提交保留", source))?;
        drop(file);
        let destination = self.root.join(format!("records-{revision:020}.json"));
        let from: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = destination.as_os_str().encode_wide().chain(Some(0)).collect();
        // Same directory/volume; do not allow copy/delete fallback or replacement of an existing commit.
        let moved = unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), MOVE_WRITE_THROUGH) };
        if moved == 0 { return Err(io_error("原生记录提交失败，已有提交未删除", std::io::Error::last_os_error())); }
        let mut warnings = warnings(&loaded.layout);
        // Cleanup happens after commit; failure cannot turn this committed write into a failed operation.
        for (older, path) in &loaded.layout.committed {
            if *older < revision.saturating_sub(1) {
                if self.table(path, *older).is_err() || fs::remove_file(path).is_err() {
                    warnings.push(format!("提交 {older} 的旧容器清理未完成；当前提交 {revision} 仍已保存"));
                }
            }
        }
        Ok(CommitResult { revision, warnings })
    }
}

fn observe(seen: &mut u64, revision: u64) -> Result<()> {
    if revision < *seen { return Err(error("NATIVE_STORAGE_REVISION", "存储代次发生倒退，未自动采用旧容器")); }
    *seen = revision;
    Ok(())
}

fn warnings(layout: &Layout) -> Vec<String> {
    if layout.pending == 0 { Vec::new() }
    else { vec![format!("保留了 {} 个未提交临时文件；它们不作为已保存记录读取", layout.pending)] }
}
fn snapshot_revision(name: &str) -> Option<u64> {
    let number = name.strip_prefix("records-")?.strip_suffix(".json")?;
    if number.len() != 20 || !number.bytes().all(|byte| byte.is_ascii_digit()) { return None; }
    number.parse::<u64>().ok().filter(|revision| (1..=MAX_REVISION).contains(revision))
}
fn pending_name(name: &str) -> bool {
    let Some(body) = name.strip_prefix("pending-").and_then(|body| body.strip_suffix(".tmp")) else { return false };
    let parts: Vec<_> = body.split('-').collect();
    parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
}
