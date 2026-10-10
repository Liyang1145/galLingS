//! AGM 联想层：记忆条目共现图 + 扩散激活（PLAN §13.1）。
//!
//! - 节点是记忆条目 id（灵枢原文的 id），图里不存原文。
//! - 边来自"同一回合一起被用到的条目"（召回的 + 新写入的），权重 = 共现次数，带 {lineage, turn}。
//! - 读档后被放弃的时间线：边**只隐藏不删除**（按可见时间线过滤），给日后 Meta 线留地基（PLAN §22）。
//! - 激活值用整数定点（×1000），保证三平台结果逐字一致。

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Edge {
    pub a: String,
    pub b: String,
    pub lineage: String,
    pub turn: u64,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Agm {
    pub edges: Vec<Edge>,
}

/// 一条可见时间线：`lineage` 上回合 ≤ `max_turn` 的内容可见。
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Visible {
    pub lineage: String,
    pub max_turn: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Seed {
    pub id: String,
    /// 种子分数，定点 ×1000（灵枢排序分数换算而来）
    pub score: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Activated {
    pub id: String,
    pub activation: i64,
    /// 联想路径：种子 → … → 本条
    pub path: Vec<String>,
}

fn visible(e: &Edge, vis: &[Visible]) -> bool {
    vis.iter().any(|v| v.lineage == e.lineage && e.turn <= v.max_turn)
}

impl Agm {
    pub fn observe(&mut self, items: &[String], lineage: &str, turn: u64) {
        let uniq: BTreeSet<&String> = items.iter().collect();
        let v: Vec<&String> = uniq.into_iter().collect();
        for i in 0..v.len() {
            for j in (i + 1)..v.len() {
                self.edges.push(Edge { a: v[i].clone(), b: v[j].clone(), lineage: lineage.into(), turn });
            }
        }
    }

    /// 两跳扩散激活，衰减 1/2；返回不在 `exclude` 里的前 k 个条目。
    pub fn recall(&self, seeds: &[Seed], exclude: &[String], k: usize, vis: &[Visible]) -> Vec<Activated> {
        // 邻接表（只含可见边），权重 = 共现次数
        let mut adj: BTreeMap<&str, BTreeMap<&str, i64>> = BTreeMap::new();
        for e in self.edges.iter().filter(|e| visible(e, vis)) {
            *adj.entry(&e.a).or_default().entry(&e.b).or_insert(0) += 1;
            *adj.entry(&e.b).or_default().entry(&e.a).or_insert(0) += 1;
        }
        let mut act: BTreeMap<String, (i64, Vec<String>)> = BTreeMap::new();
        let mut frontier: Vec<(String, i64, Vec<String>)> =
            seeds.iter().map(|s| (s.id.clone(), s.score, vec![s.id.clone()])).collect();
        for _hop in 0..2 {
            let mut next = Vec::new();
            for (id, a, path) in &frontier {
                if let Some(nb) = adj.get(id.as_str()) {
                    let deg: i64 = nb.values().sum::<i64>().max(1);
                    for (n, w) in nb {
                        if path.iter().any(|p| p == n) {
                            continue;
                        }
                        let gain = a * w / deg / 2; // 按边权分摊，再衰减一半
                        if gain <= 0 {
                            continue;
                        }
                        let mut p = path.clone();
                        p.push((*n).to_string());
                        let ent = act.entry((*n).to_string()).or_insert((0, p.clone()));
                        ent.0 += gain;
                        if p.len() < ent.1.len() {
                            ent.1 = p.clone();
                        }
                        next.push(((*n).to_string(), gain, p));
                    }
                }
            }
            frontier = next;
        }
        let ex: BTreeSet<&String> = exclude.iter().chain(seeds.iter().map(|s| &s.id)).collect();
        let mut out: Vec<Activated> = act
            .into_iter()
            .filter(|(id, _)| !ex.contains(id))
            .map(|(id, (a, path))| Activated { id, activation: a, path })
            .collect();
        out.sort_by(|x, y| y.activation.cmp(&x.activation).then(x.id.cmp(&y.id)));
        out.truncate(k);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(x: &str) -> String {
        x.to_string()
    }

    #[test]
    fn spreads_and_respects_timeline() {
        let mut g = Agm::default();
        g.observe(&[s("m1"), s("m2")], "L0", 1);
        g.observe(&[s("m2"), s("m3")], "L0", 2);
        g.observe(&[s("m1"), s("m9")], "L0.1", 5); // 另一条时间线
        let seeds = vec![Seed { id: s("m1"), score: 1000 }];
        let vis = vec![Visible { lineage: s("L0"), max_turn: 10 }];
        let r = g.recall(&seeds, &[], 3, &vis);
        let ids: Vec<&str> = r.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, vec!["m2", "m3"]);
        assert_eq!(r[1].path, vec![s("m1"), s("m2"), s("m3")]);
        // 回合截断：只看 turn ≤ 1
        let vis1 = vec![Visible { lineage: s("L0"), max_turn: 1 }];
        let r1 = g.recall(&seeds, &[], 3, &vis1);
        assert_eq!(r1.len(), 1);
    }
}
