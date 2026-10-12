"""玩家设置（在网页“设置”里改的那部分）：叠在 config.yaml 之上，存在 data_dir 里。

- ``settings.json``：模型地址 / 模型名、记忆底座、作品文件夹。可以随便看。
- ``secrets.json``：API 密钥。只在本机，权限 600；网页只拿得到“有没有设置 + 末 4 位”，拿不到原文。
  启动插件时把它和系统环境变量合在一起交给插件管理器（插件仍然只从“环境变量”读密钥，PLAN §17 的规矩不变）。
环境变量优先：系统里已经设了 GALLINGS_LLM_API_KEY 时，网页里填的不生效（页面会提示）。
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any

LLM_ID = "gallings.llm.openai-compat"
KEY_ENV = "GALLINGS_LLM_API_KEY"
MEM_IDS = {"local": ["gallings.memory.local"], "lingshu": ["gallings.memory.lingshu", "gallings.memory.local"]}


class SettingsStore:
    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / "settings.json"
        self.secret_path = data_dir / "secrets.json"

    # ---------------------------------------------------------------- 读写
    def load(self) -> dict[str, Any]:
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _secrets(self) -> dict[str, str]:
        try:
            return {k: str(v) for k, v in json.loads(self.secret_path.read_text(encoding="utf-8")).items() if v}
        except (OSError, ValueError):
            return {}

    def save(self, patch: dict[str, Any]) -> None:
        cur = self.load()
        for sec in ("llm", "memory", "vn"):
            if isinstance(patch.get(sec), dict):
                cur.setdefault(sec, {}).update({k: v for k, v in patch[sec].items() if k != "api_key"})
        self.path.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
        key = (patch.get("llm") or {}).get("api_key")
        if key is not None:  # 空字符串 = 清除
            sec = self._secrets()
            if key.strip():
                sec[KEY_ENV] = key.strip()
            else:
                sec.pop(KEY_ENV, None)
            # 一创建就是 600（先写后 chmod 会有一瞬间别人可读）；Windows 上权限位不起作用，靠用户目录本身的权限
            fd = os.open(self.secret_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(json.dumps(sec))
            try:
                os.chmod(self.secret_path, 0o600)  # 旧文件可能是别的权限
            except OSError:
                pass

    # ---------------------------------------------------------------- 叠到配置上
    def overlay(self, config: dict[str, Any]) -> dict[str, Any]:
        cfg = copy.deepcopy(config)
        s = self.load()
        plugins = cfg.setdefault("plugins", {})
        sel = plugins.setdefault("select", {})
        conf = plugins.setdefault("config", {})
        llm = s.get("llm") or {}
        if llm.get("base_url") or llm.get("model"):
            c = conf.setdefault(LLM_ID, {})
            for k in ("base_url", "model"):
                if llm.get(k):
                    c[k] = str(llm[k]).strip()
            if LLM_ID not in (sel.get("llm") or []):
                sel["llm"] = [LLM_ID] + list(sel.get("llm") or [])
        mem = s.get("memory") or {}
        if mem.get("use") in MEM_IDS:
            sel["memory"] = list(MEM_IDS[mem["use"]])
            if mem["use"] == "lingshu" and mem.get("dsh_memory_path"):
                conf.setdefault("gallings.memory.lingshu", {})["dsh_memory_path"] = str(mem["dsh_memory_path"])
        vn = s.get("vn") or {}
        if vn.get("games_dir"):
            cfg.setdefault("vn", {})["games_dir"] = str(vn["games_dir"])
        return cfg

    def environ(self, base: dict[str, str] | None = None) -> dict[str, str]:
        env = dict(os.environ if base is None else base)
        for k, v in self._secrets().items():
            env.setdefault(k, v)  # 系统环境变量优先
        return env

    def public(self, config: dict[str, Any], base_env: dict[str, str] | None = None) -> dict[str, Any]:
        """给网页看的：不含密钥原文。"""
        env = os.environ if base_env is None else base_env
        conf = ((config.get("plugins") or {}).get("config") or {})
        sel = ((config.get("plugins") or {}).get("select") or {})
        llm_c = conf.get(LLM_ID) or {}
        key = env.get(KEY_ENV) or self._secrets().get(KEY_ENV) or ""
        mem_sel = sel.get("memory") or []
        return {
            "llm": {"base_url": llm_c.get("base_url", "https://api.deepseek.com"), "model": llm_c.get("model", "deepseek-flash"),
                    "key_set": bool(key), "key_tail": key[-4:] if len(key) >= 8 else "", "key_from_env": bool(env.get(KEY_ENV))},
            "memory": {"use": "lingshu" if "gallings.memory.lingshu" in mem_sel else "local",
                       "dsh_memory_path": (conf.get("gallings.memory.lingshu") or {}).get("dsh_memory_path", "")},
            "vn": {"games_dir": str((config.get("vn") or {}).get("games_dir", ""))},
        }
