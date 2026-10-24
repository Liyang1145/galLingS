//! Integration addresses only. These strings are never converted into filesystem paths.
use serde_json::Value;

const SAVE: &str = "haifeng.save/1";
const RECORDS: [&str; 5] = [
    "haifeng.player-records/1",
    "haifeng.audio-preferences/1",
    "haifeng.reading-preferences/1",
    "haifeng.button-preferences/1",
    "haifeng.readout-preferences/1",
];
const RANGES: [(&str, &str); 2] = [
    ("development", "normal-entry"),
    ("preview", "timed-choice:pm8x8v2h"),
];

pub(super) struct Addresses {
    progress: Vec<String>,
    records: Vec<String>,
}

impl Addresses {
    pub(super) fn new(work: &str) -> Result<Self, &'static str> {
        if work.trim().is_empty() || work.encode_utf16().count() > 128 {
            return Err("作品身份需要 1～128 个 UTF-16 单元");
        }
        let progress = RANGES.iter().map(|(kind, scope)| {
            let mut key = serde_json::to_string(&[SAVE, work, *kind, *scope])
                .expect("固定字符串地址可以序列化");
            key.pop();
            key.push(',');
            key
        }).collect();
        let records = RECORDS.iter().map(|format| {
            serde_json::to_string(&[*format, work, "development", "normal-entry"])
                .expect("固定字符串地址可以序列化")
        }).collect();
        Ok(Self { progress, records })
    }

    pub(super) fn is_progress(&self, key: &str) -> bool {
        if key.len() > 4096 { return false; }
        self.progress.iter().any(|prefix| {
            key.strip_prefix(prefix).and_then(|tail| tail.strip_suffix(']'))
                .map(valid_slot_literal).unwrap_or(false)
        })
    }

    pub(super) fn is_record(&self, key: &str) -> bool {
        self.records.iter().any(|allowed| allowed == key)
    }

    pub(super) fn contains(&self, key: &str) -> bool {
        self.is_record(key) || self.is_progress(key)
    }

    pub(super) fn is_prefix(&self, prefix: &str) -> bool {
        self.progress.iter().any(|allowed| allowed == prefix)
    }

    pub(super) fn matches_value(&self, key: &str, value: &Value) -> bool {
        // Domain fields remain opaque: TypeScript repositories validate their full payloads.
        // The native boundary only prevents a record family from being written to another family.
        let Some(format) = value.get("format").and_then(Value::as_str) else { return false };
        if self.is_progress(key) { return format == SAVE; }
        self.records.iter().zip(RECORDS.iter()).any(|(allowed, family)| {
            allowed == key && format == *family
        })
    }
}

/// Validate the JSON string syntax/count without interpreting isolated UTF-16 surrogate escapes.
/// JSON.stringify permits those escapes in a named slot; UTF-8 decoding them into Rust would lose parity.
fn valid_slot_literal(value: &str) -> bool {
    let Some(inner) = value.strip_prefix('"').and_then(|text| text.strip_suffix('"')) else { return false };
    let mut chars = inner.chars();
    let mut units = 0;
    while let Some(character) = chars.next() {
        if character == '\\' {
            match chars.next() {
                Some('"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't') => {}
                Some('u') => {
                    for _ in 0..4 {
                        if !chars.next().map(|digit| digit.is_ascii_hexdigit()).unwrap_or(false) {
                            return false;
                        }
                    }
                }
                _ => return false,
            }
            units += 1;
        } else {
            if character == '"' || character <= '\u{001f}' { return false; }
            units += character.len_utf16();
        }
        if units > 128 { return false; }
    }
    units > 0
}

/// IndexedDB and JavaScript string comparison use UTF-16 code units, not UTF-8 byte order.
pub(super) fn compare_keys(left: &str, right: &str) -> std::cmp::Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}
