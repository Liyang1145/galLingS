//! 状态哈希与随机数。
//!
//! 哈希：FNV-1a 64 位，作用在规范化 JSON 上（serde_json 的 Map 是 BTreeMap，键有序；状态里不放浮点数）。
//! PLAN §4.1 写的是 xxh3-64；这里选 FNV-1a 是为了零依赖、三平台逐字节一致。只用于"回放是否一致"的判定，
//! 不做安全用途。以后要换 xxh3，改这一个函数并升 `log_version` 即可。

pub fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

pub fn hex64(v: u64) -> String {
    format!("{v:016x}")
}

/// PCG32（PLAN §4.1：随机数只在核心里产生，种子写在日志头）。
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct Pcg32 {
    pub state: u64,
    pub inc: u64,
}

impl Pcg32 {
    pub fn new(seed: u64) -> Self {
        let mut r = Pcg32 { state: 0, inc: (0xda3e_39cb_94b9_5bdb_u64 << 1) | 1 };
        r.next_u32();
        r.state = r.state.wrapping_add(seed);
        r.next_u32();
        r
    }

    pub fn next_u32(&mut self) -> u32 {
        let old = self.state;
        self.state = old.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(self.inc);
        let xorshifted = (((old >> 18) ^ old) >> 27) as u32;
        let rot = (old >> 59) as u32;
        xorshifted.rotate_right(rot)
    }

    /// [0, n) 的均匀整数（n > 0）。
    pub fn below(&mut self, n: u32) -> u32 {
        let threshold = n.wrapping_neg() % n;
        loop {
            let r = self.next_u32();
            if r >= threshold {
                return r % n;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv_known_vector() {
        assert_eq!(fnv1a64(b""), 0xcbf29ce484222325);
        assert_eq!(fnv1a64(b"a"), 0xaf63dc4c8601ec8c);
    }

    #[test]
    fn pcg_is_deterministic() {
        let mut a = Pcg32::new(42);
        let mut b = Pcg32::new(42);
        for _ in 0..100 {
            assert_eq!(a.next_u32(), b.next_u32());
        }
        assert!(a.below(7) < 7);
    }
}
