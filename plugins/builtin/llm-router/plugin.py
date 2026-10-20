"""gallings.llm.router：多模型 LLM 插件，正在用的模型 + 每个模型的思考等级（设置面板见 web/panel.js）。

数据都在插件自己的数据目录 ``<数据根>/plugins/gallings.llm.router/``：
- ``models.json``：模型列表、正在用的模型（main）。可以随便看，不含密钥。
- ``keys.json``：每个模型的 API 密钥，权限 600，只在本机；网页只拿得到“有没有 + 末 4 位”。

用法（引擎侧）：``Runtime.llm_chain(purpose)`` 调 ``chain_for(purpose)`` 拿到正在用的模型（purpose 不再区分）；
链里每一项都是一个有 ``stream()`` 和 ``ctx.plugin_id`` 的对象，和普通 llm 插件一样交给 ``stream_events`` / ``complete``。
改模型、切换立即生效，不用重启插件；已经开着的剧本会话下次开局才换。
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
import re
import time
import uuid
from dataclasses import asdict
from pathlib import Path
from types import SimpleNamespace
from typing import Any, AsyncIterator

import httpx

from server.plugins import ChatRequest, Error, LLMEvent, LLMPlugin, Usage

from .sse import StreamNormalizer

PLUGIN_ID = "gallings.llm.router"

# 预设：和作品内「设置 → AI 模型」同一份服务商列表（content/imports/vnstudio/海风与布丁/index.html MODEL_PRESETS）
PRESETS: list[dict[str, Any]] = [
    {"id": "deepseek", "name": "DeepSeek", "base_url": "https://api.deepseek.com",
     "models": ["deepseek-chat", "deepseek-reasoner", "deepseek-flash"], "key_url": "https://platform.deepseek.com/api_keys"},
    {"id": "qwen", "name": "通义千问", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
     "models": ["qwen-plus", "qwen-turbo", "qwen-max"], "key_url": "https://bailian.console.aliyun.com/"},
    {"id": "siliconflow", "name": "硅基流动", "base_url": "https://api.siliconflow.cn/v1",
     "models": ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"], "key_url": "https://cloud.siliconflow.cn/account/ak"},
    {"id": "moonshot", "name": "Kimi", "base_url": "https://api.moonshot.cn/v1",
     "models": ["moonshot-v1-8k", "moonshot-v1-32k"], "key_url": "https://platform.moonshot.cn/console/api-keys"},
    {"id": "openrouter", "name": "OpenRouter", "base_url": "https://openrouter.ai/api/v1",
     "models": ["deepseek/deepseek-chat", "openai/gpt-4o-mini"], "key_url": "https://openrouter.ai/keys"},
    {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com/v1",
     "models": ["gpt-4o-mini", "gpt-4o"], "key_url": "https://platform.openai.com/api-keys"},
    {"id": "ollama", "name": "Ollama（本机）", "base_url": "http://127.0.0.1:11434/v1",
     "models": ["qwen2.5:7b", "llama3.1:8b"], "no_key": True},
    {"id": "custom", "name": "自定义", "base_url": "", "models": []},
]

THINK_LEVELS = ("off", "mid", "high")   # 思考等级：关 / 中 / 高


def think_params(base_url: str, level: str) -> dict[str, Any]:
    """思考等级 → 各家接口的请求参数。各家写法不一样，不认识的服务按 OpenAI 的 reasoning_effort 发（关 = 不发）。"""
    host = (httpx.URL(base_url).host or "").lower() if base_url else ""
    on = level in ("mid", "high")
    if "deepseek.com" in host:          # DeepSeek：thinking 只有开 / 关（flash 默认开，关掉免得短回复被思考吃光）
        return {"thinking": {"type": "enabled" if on else "disabled"}}
    if "dashscope" in host or "siliconflow" in host:   # 通义千问 / 硅基流动：enable_thinking + 思考预算
        return {"enable_thinking": on, **({"thinking_budget": 4096 if level == "mid" else 16384} if on else {})}
    if "openrouter.ai" in host:          # OpenRouter：统一的 reasoning 字段
        return {"reasoning": {"effort": "medium" if level == "mid" else "high"}} if on else {"reasoning": {"enabled": False}}
    if "moonshot" in host:               # Kimi：模型自己决定，不发参数
        return {}
    return {"reasoning_effort": "medium" if level == "mid" else "high"} if on else {}


def _message(m) -> dict[str, Any]:
    return {k: v for k, v in asdict(m).items() if v is not None}


def _clean_base(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    return re.sub(r"/chat/completions$", "", url)


def _is_local(url: str) -> bool:
    try:
        return httpx.URL(url).host in ("127.0.0.1", "localhost", "::1")
    except Exception:  # noqa: BLE001
        return False


def _friendly(status: int, text: str) -> tuple[str, str]:
    """HTTP 错误 → (code, 一句人话)。"""
    low = text.lower()
    if status in (401, 403):
        return "auth", "密钥不对或没有权限（HTTP %d）" % status
    if status == 402 or "insufficient" in low or "balance" in low or "余额" in text:
        return "quota", "账户余额不足（HTTP %d）" % status
    if status == 404:
        return "not_found", "地址或模型名不对（HTTP 404）"
    if status == 429:
        return "rate_limit", "请求太频繁或额度用完了（HTTP 429）"
    if status >= 500:
        return "server", "服务商那边出错了（HTTP %d），稍后再试" % status
    return "unknown", "HTTP %d：%s" % (status, text[:120])


class ProfileLLM:
    """一个模型配置的流式客户端。不是独立插件，由路由插件按需创建；接口和 LLMPlugin 一致（stream + ctx.plugin_id）。"""

    def __init__(self, profile: dict[str, Any], key: str, connect_timeout: float) -> None:
        self.profile = profile
        self.ctx = SimpleNamespace(plugin_id=PLUGIN_ID, profile=profile["id"], profile_name=profile.get("name", ""))
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        if "openrouter.ai" in profile["base_url"]:
            headers.update({"HTTP-Referer": "https://github.com/Liyang1145/galLingS", "X-Title": "galLingS"})
        self._client = httpx.AsyncClient(
            base_url=profile["base_url"],
            timeout=httpx.Timeout(60 if (profile.get("think") or "off") == "off" else 180, connect=connect_timeout),
            headers=headers, trust_env=not _is_local(profile["base_url"]))   # 本机服务（Ollama）不走系统代理

    def body(self, request: ChatRequest) -> dict[str, Any]:
        p = self.profile
        body: dict[str, Any] = {"model": p["model"], "stream": True, "stream_options": {"include_usage": True},
                                "messages": [_message(m) for m in request.messages], **request.extra}
        if request.temperature is not None:
            body["temperature"] = request.temperature
        level = p.get("think") or "off"
        for k, v in think_params(p["base_url"], level).items():
            body.setdefault(k, v)
        if request.max_tokens:
            # 开着思考时，思考也算在输出里：调用方给的上限按等级放宽，免得只剩思考、正文为空
            body["max_tokens"] = request.max_tokens if level == "off" else request.max_tokens + (2048 if level == "mid" else 8192)
        if request.tools:
            body["tools"] = request.tools
        if request.stop:
            body["stop"] = request.stop
        return body

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        t0 = time.perf_counter()
        norm = StreamNormalizer()
        try:
            async with self._client.stream("POST", "/chat/completions", json=self.body(request)) as resp:
                if resp.status_code != 200:
                    text = (await resp.aread()).decode("utf-8", "replace")[:300]
                    code, msg = _friendly(resp.status_code, text)
                    yield Error(code, f"{self.profile.get('name')}：{msg}", retryable=resp.status_code in (429, 500, 502, 503, 504))
                    return
                async for line in resp.aiter_lines():
                    for ev in norm.feed_line(line):
                        if isinstance(ev, Usage):
                            ev = Usage(ev.prompt_tokens, ev.completion_tokens, (time.perf_counter() - t0) * 1000)
                        yield ev
                for ev in norm.finish():
                    yield ev
        except httpx.TimeoutException as e:
            yield Error("timeout", f"{self.profile.get('name')}：请求超时 {e or ''}".strip(), retryable=True)
        except httpx.HTTPError as e:
            yield Error("network", f"{self.profile.get('name')}：连不上（{type(e).__name__}）", retryable=True)

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "base_url": self.profile["base_url"], "model": self.profile["model"]}

    async def close(self) -> None:
        await self._client.aclose()


class LLMRouter(LLMPlugin):
    """多模型。自身也能当普通 llm 插件用：stream() 走正在用的模型。"""

    panel_slot = "llm"   # 设置面板挂在作品页设置的“模型”一节，替换旧的单模型输入框

    async def setup(self) -> None:
        self._path: Path = self.ctx.data_dir / "models.json"
        self._key_path: Path = self.ctx.data_dir / "keys.json"
        self._clients: dict[str, tuple[str, ProfileLLM]] = {}   # 模型 id → (配置指纹, 客户端)
        self._lock = asyncio.Lock()
        self._state = self._load()
        self._keys = self._load_keys()
        if not self._path.exists():
            self._seed()
            self._save()

    # ------------------------------------------------------------------ 存储
    def _load(self) -> dict[str, Any]:
        try:
            s = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            s = {}
        s.setdefault("models", [])
        s.setdefault("main", "")
        return s

    def _load_keys(self) -> dict[str, str]:
        try:
            return {k: str(v) for k, v in json.loads(self._key_path.read_text(encoding="utf-8")).items() if v}
        except (OSError, ValueError):
            return {}

    def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def _save_keys(self) -> None:
        # 一创建就是 600；Windows 上权限位不起作用，靠用户目录本身的权限
        fd = os.open(self._key_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(self._keys))
        try:
            os.chmod(self._key_path, 0o600)
        except OSError:
            pass

    def _seed(self) -> None:
        """第一次启动：把旧的单模型设置（有密钥时）导入成第一条。"""
        seed = self.ctx.config.get("seed") or {}
        key = self.ctx.secrets.get("seed_api_key")
        if not key or not seed.get("base_url"):
            return
        base = _clean_base(seed["base_url"])
        preset = next((p for p in PRESETS if p["base_url"] and _clean_base(p["base_url"]) == base), None)
        m = self._normalize({"name": preset["name"] if preset else "我的模型", "preset": preset["id"] if preset else "custom",
                             "base_url": base, "model": seed.get("model") or (preset["models"][0] if preset else "")})
        self._state["models"].append(m)
        self._state["main"] = m["id"]
        self._keys[m["id"]] = key
        self._save_keys()

    # ------------------------------------------------------------------ 取用
    def _model(self, mid: str) -> dict[str, Any] | None:
        return next((m for m in self._state["models"] if m["id"] == mid), None)

    def _usable(self, m: dict[str, Any] | None) -> bool:
        if not m or not m.get("base_url") or not m.get("model"):
            return False
        return bool(self._keys.get(m["id"])) or self._no_key(m)

    @staticmethod
    def _no_key(m: dict[str, Any]) -> bool:
        p = next((x for x in PRESETS if x["id"] == m.get("preset")), None)
        if p and p.get("no_key"):
            return True
        return _is_local(m.get("base_url") or "")   # 本机服务（Ollama、LM Studio）一般不要密钥

    def _client(self, m: dict[str, Any]) -> ProfileLLM:
        fp = json.dumps(m, sort_keys=True) + "|" + self._keys.get(m["id"], "")
        cur = self._clients.get(m["id"])
        if cur and cur[0] == fp:
            return cur[1]
        if cur:
            asyncio.ensure_future(cur[1].close())
        cli = ProfileLLM(m, self._keys.get(m["id"], ""), float(self.ctx.config.get("connect_timeout_s", 10)))
        self._clients[m["id"]] = (fp, cli)
        return cli

    def main_id(self) -> str:
        if self._usable(self._model(self._state["main"])):
            return self._state["main"]
        first = next((m for m in self._state["models"] if self._usable(m)), None)
        return first["id"] if first else ""

    def chain_for(self, purpose: str | None = None) -> list[ProfileLLM]:
        """这次调用用的模型：就是当前选中的那一个（purpose 只为接口兼容保留，不再按用途分配）。空列表 = 没有可用模型。"""
        main = self.main_id()
        return [self._client(self._model(main))] if main else []

    async def stream(self, request: ChatRequest) -> AsyncIterator[LLMEvent]:
        chain = self.chain_for(None)
        if not chain:
            yield Error("unknown", "LLM API：还没有可用的模型（设置里添加一个并填好密钥）")
            return
        last: Error | None = None
        for cli in chain:
            got = False
            async for ev in cli.stream(request):
                if isinstance(ev, Error) and not got:
                    last = ev
                    break
                got = True
                yield ev
            else:
                return
            if got:
                return
        yield last or Error("unknown", "没有可用的模型")

    async def health(self) -> dict[str, Any]:
        main = self._model(self.main_id())
        return {"ok": True, "models": len(self._state["models"]), "main": main.get("name") if main else "",
                "usable": bool(main)}

    async def close(self) -> None:
        for _fp, cli in list(getattr(self, "_clients", {}).values()):
            await cli.close()
        self._clients = {}

    # ------------------------------------------------------------------ 设置面板接口（POST /api/plugin/gallings.llm.router/<action>）
    def _normalize(self, raw: dict[str, Any], old: dict[str, Any] | None = None) -> dict[str, Any]:
        m = {"id": (old or {}).get("id") or raw.get("id") or uuid.uuid4().hex[:10]}
        m["preset"] = str(raw.get("preset") or "custom")
        if m["preset"] not in {p["id"] for p in PRESETS}:
            m["preset"] = "custom"
        m["base_url"] = _clean_base(str(raw.get("base_url") or ""))
        m["model"] = str(raw.get("model") or "").strip()
        m["name"] = (str(raw.get("name") or "").strip() or m["model"] or "未命名模型")[:40]
        lv = raw.get("think") or "off"
        m["think"] = lv if lv in THINK_LEVELS else "off"
        return m

    def public(self) -> dict[str, Any]:
        models = []
        for m in self._state["models"]:
            k = self._keys.get(m["id"], "")
            models.append({**m, "key_set": bool(k), "key_tail": k[-4:] if len(k) >= 8 else "",
                           "no_key": self._no_key(m), "usable": self._usable(m)})
        return {"models": models, "main": self.main_id(), "main_saved": self._state["main"],
                "presets": PRESETS, "think_levels": [{"id": "off", "name": "关"}, {"id": "mid", "name": "中"}, {"id": "high", "name": "高"}]}

    async def api(self, action: str, body: dict[str, Any]) -> dict[str, Any]:
        async with self._lock:
            return await self._api(action, body or {})

    async def _api(self, action: str, body: dict[str, Any]) -> dict[str, Any]:
        st = self._state
        if action == "state":
            return {"ok": True, **self.public()}
        if action == "save":   # 新增或修改；api_key：不传 = 不改，空字符串 = 清除
            raw = body.get("model") or {}
            old = self._model(str(raw.get("id") or "")) if raw.get("id") else None
            try:
                m = self._normalize(raw, old)
            except ValueError as e:
                return {"ok": False, "message": str(e), **self.public()}
            if not m["base_url"] or not m["model"]:
                return {"ok": False, "message": "Base URL 和 Model Name 都要填", **self.public()}
            if old:
                st["models"][st["models"].index(old)] = m
            else:
                st["models"].append(m)
            key = body.get("api_key")
            if key is not None:
                if str(key).strip():
                    self._keys[m["id"]] = str(key).strip()
                else:
                    self._keys.pop(m["id"], None)
                self._save_keys()
            if not st["main"] or not self._model(st["main"]):
                st["main"] = m["id"]
            self._save()
            return {"ok": True, "id": m["id"], **self.public()}
        if action == "delete":
            mid = str(body.get("id") or "")
            st["models"] = [m for m in st["models"] if m["id"] != mid]
            if self._keys.pop(mid, None) is not None:
                self._save_keys()
            if st["main"] == mid:
                st["main"] = st["models"][0]["id"] if st["models"] else ""
            cur = self._clients.pop(mid, None)
            if cur:
                await cur[1].close()
            self._save()
            return {"ok": True, **self.public()}
        if action == "duplicate":
            src = self._model(str(body.get("id") or ""))
            if not src:
                return {"ok": False, "message": "没有这个模型", **self.public()}
            m = copy.deepcopy(src)
            m["id"] = uuid.uuid4().hex[:10]
            m["name"] = (src["name"] + " 副本")[:40]
            st["models"].insert(st["models"].index(src) + 1, m)
            if src["id"] in self._keys:
                self._keys[m["id"]] = self._keys[src["id"]]
                self._save_keys()
            self._save()
            return {"ok": True, "id": m["id"], **self.public()}
        if action == "main":
            mid = str(body.get("id") or "")
            if not self._model(mid):
                return {"ok": False, "message": "没有这个模型", **self.public()}
            st["main"] = mid
            self._save()
            return {"ok": True, **self.public()}
        if action == "order":
            ids = [str(i) for i in body.get("ids") or []]
            pos = {i: n for n, i in enumerate(ids)}
            st["models"].sort(key=lambda m: pos.get(m["id"], len(ids)))
            self._save()
            return {"ok": True, **self.public()}
        if action == "test":
            return await self._test(body)
        if action == "models":
            return await self._list_remote(body)
        return {"ok": False, "message": f"未知操作：{action}"}

    def _draft(self, body: dict[str, Any]) -> tuple[dict[str, Any] | None, str, str]:
        """测试 / 拉列表用：已保存的模型（id）或弹窗里还没保存的草稿（model + api_key，密钥不填就沿用已存的）。"""
        if body.get("model"):
            raw = body["model"]
            old = self._model(str(raw.get("id") or "")) if raw.get("id") else None
            try:
                m = self._normalize(raw, old)
            except ValueError as e:
                return None, "", str(e)
            key = body.get("api_key")
            key = str(key).strip() if key else self._keys.get(m["id"], "") if old else ""
            return m, key, ""
        m = self._model(str(body.get("id") or ""))
        if not m:
            return None, "", "没有这个模型"
        return m, self._keys.get(m["id"], ""), ""

    async def _test(self, body: dict[str, Any]) -> dict[str, Any]:
        m, key, err = self._draft(body)
        if err or not m:
            return {"ok": False, "message": err}
        if not m["base_url"] or not m["model"]:
            return {"ok": False, "message": "Base URL 和 Model Name 都要填"}
        if not key and not self._no_key(m):
            return {"ok": False, "message": "还没填 API Key"}
        cli = ProfileLLM(m, key, 10)
        from server.plugins import ChatMessage, TextDelta
        req = ChatRequest([ChatMessage("user", "只回复两个字：在呢")], max_tokens=32)
        text, t0 = "", time.perf_counter()
        try:
            async for ev in cli.stream(req):
                if isinstance(ev, Error):
                    return {"ok": False, "message": ev.message.split("：", 1)[-1]}
                if isinstance(ev, TextDelta):
                    text += ev.text
        finally:
            await cli.close()
        ms = int((time.perf_counter() - t0) * 1000)
        if not text.strip():
            return {"ok": False, "message": "连上了，但只返回了空内容（思考把字数用完了，试试把思考等级调低）", "ms": ms}
        return {"ok": True, "message": f"通了：{text.strip()[:20]}（{ms} ms）", "ms": ms}

    async def _list_remote(self, body: dict[str, Any]) -> dict[str, Any]:
        m, key, err = self._draft(body)
        if err or not m or not m["base_url"]:
            return {"ok": False, "message": err or "先填 Base URL", "models": []}
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        try:
            async with httpx.AsyncClient(timeout=15, trust_env=not _is_local(m["base_url"])) as c:
                r = await c.get(m["base_url"] + "/models", headers=headers)
        except httpx.HTTPError as e:
            return {"ok": False, "message": f"连不上（{type(e).__name__}）", "models": []}
        if r.status_code != 200:
            return {"ok": False, "message": _friendly(r.status_code, r.text)[1], "models": []}
        try:
            ids = sorted({str(x.get("id")) for x in (r.json().get("data") or []) if x.get("id")})
        except (ValueError, AttributeError):
            ids = []
        return {"ok": bool(ids), "message": "" if ids else "服务没返回模型列表", "models": ids[:300]}
