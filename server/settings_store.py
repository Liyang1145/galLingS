"""玩家设置（在网页“设置”里改的那部分）：叠在 config.yaml 之上，存在 data_dir 里。

- ``settings.json``：模型网关（OpenAI兼容 / Claude / Gemini / Ollama）、服务地址 / 模型名、记忆底座、作品文件夹。可以随便看。
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
LLM_PROVIDERS = {
    "openai-compat": "gallings.llm.openai-compat",
    "anthropic": "gallings.llm.anthropic",
    "gemini": "gallings.llm.gemini",
    "ollama": "gallings.llm.ollama",
}
LLM_DEFAULTS = {
    "openai-compat": ("https://api.deepseek.com", "deepseek-flash"),
    "anthropic": ("https://api.anthropic.com", "claude-3-5-sonnet-latest"),
    "gemini": ("https://generativelanguage.googleapis.com", "gemini-2.5-flash"),
    "ollama": ("http://127.0.0.1:11434/v1", "qwen2.5:7b"),
}
KEY_ENV = "GALLINGS_LLM_API_KEY"
MEM_IDS = {"local": ["gallings.memory.local"], "lingshu": ["gallings.memory.lingshu", "gallings.memory.local"]}


def _infer_provider(llm: dict[str, Any]) -> str:
    prov = str(llm.get("provider") or "").strip().lower()
    if prov in LLM_PROVIDERS:
        return prov
    u = str(llm.get("base_url") or "").lower()
    m = str(llm.get("model") or "").lower()
    if "anthropic.com" in u or m.startswith("claude-"):
        return "anthropic"
    if "generativelanguage.googleapis.com" in u or m.startswith("gemini-"):
        return "gemini"
    if ":11434" in u:
        return "ollama"
    return "openai-compat"


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
        if llm.get("provider") or llm.get("base_url") or llm.get("model"):
            prov = _infer_provider(llm)
            pid = LLM_PROVIDERS[prov]
            def_url, def_model = LLM_DEFAULTS[prov]
            c = conf.setdefault(pid, {})
            c["base_url"] = str(llm.get("base_url") or c.get("base_url") or def_url).strip()
            c["model"] = str(llm.get("model") or c.get("model") or def_model).strip()
            # 同时同步到 openai-compat 方便回退与旧测试读取
            if pid != LLM_ID:
                oc = conf.setdefault(LLM_ID, {})
                oc["base_url"] = c["base_url"]
                oc["model"] = c["model"]
            existing = [x for x in (sel.get("llm") or []) if x != pid]
            sel["llm"] = [pid] + existing
        mem = s.get("memory") or {}
        if mem.get("use") in MEM_IDS:
            sel["memory"] = list(MEM_IDS[mem["use"]])
            if mem["use"] == "lingshu":
                conf.setdefault("gallings.memory.lingshu", {})["dsh_memory_path"] = str(mem.get("dsh_memory_path") or "")
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
        llm_sel = sel.get("llm") or [LLM_ID]
        active_pid = llm_sel[0] if llm_sel else LLM_ID
        rev_map = {v: k for k, v in LLM_PROVIDERS.items()}
        prov = rev_map.get(active_pid, "openai-compat")
        def_url, def_model = LLM_DEFAULTS.get(prov, LLM_DEFAULTS["openai-compat"])
        llm_c = conf.get(active_pid) or conf.get(LLM_ID) or {}
        key = env.get(KEY_ENV) or self._secrets().get(KEY_ENV) or ""
        mem_sel = sel.get("memory") or []
        return {
            "llm": {
                "provider": prov,
                "providers": list(LLM_PROVIDERS.keys()),
                "base_url": llm_c.get("base_url", def_url),
                "model": llm_c.get("model", def_model),
                "key_set": bool(key) or prov == "ollama",
                "key_tail": key[-4:] if len(key) >= 8 else "",
                "key_from_env": bool(env.get(KEY_ENV)),
            },
            "memory": {
                "use": "lingshu" if "gallings.memory.lingshu" in mem_sel else "local",
                "dsh_memory_path": (conf.get("gallings.memory.lingshu") or {}).get("dsh_memory_path", ""),
            },
            "vn": {"games_dir": str((config.get("vn") or {}).get("games_dir", ""))},
        }
