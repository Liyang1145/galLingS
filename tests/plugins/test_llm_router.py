"""gallings.llm.router：多模型列表、正在用的模型、思考等级、密钥不外泄、设置面板接口。"""
from __future__ import annotations

import json
import os
import stat
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from server.director.llm import complete
from server.plugins import PluginManager, PluginSettings

from .conftest import BUILTIN

RID = "gallings.llm.router"


def _think_params():
    from server.plugins.loader import load_class
    from server.plugins.manifest import load_manifest
    load_class(load_manifest(BUILTIN / "llm-router"))
    return sys.modules[[n for n in sys.modules if n.endswith("gallings_llm_router.plugin")][0]].think_params


class _H(BaseHTTPRequestHandler):
    seen: list[dict] = []

    def log_message(self, *a):  # noqa: D401
        pass

    def do_GET(self):
        if self.path.endswith("/models"):
            body = json.dumps({"data": [{"id": "m-a"}, {"id": "m-b"}]}).encode()
            self.send_response(200 if self.headers.get("authorization") == "Bearer sk-good" else 401)
            self.end_headers()
            self.wfile.write(body)

    def do_POST(self):
        req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
        _H.seen.append({"path": self.path, "auth": self.headers.get("authorization"), "req": req})
        if self.headers.get("authorization") != "Bearer sk-good":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'{"error":{"message":"bad key"}}')
            return
        if "/broken" in self.path:
            self.send_response(503)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.end_headers()
        for piece in ("在", "呢·" + req["model"]):
            self.wfile.write(("data: " + json.dumps({"choices": [{"delta": {"content": piece}}]}, ensure_ascii=False) + "\n\n").encode())
        self.wfile.write(b'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n\ndata: [DONE]\n\n')


@pytest.fixture(scope="module")
def fake():
    # 用 127.0.0.2：同样是本机回环，但不算“本机服务”（127.0.0.1 / localhost 不要求密钥），才能测密钥逻辑
    srv = ThreadingHTTPServer(("127.0.0.2", 0), _H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    old = {k: os.environ.get(k) for k in ("NO_PROXY", "no_proxy")}
    for k in old:
        os.environ[k] = ",".join(filter(None, [old[k], "127.0.0.2"]))
    yield f"http://127.0.0.2:{srv.server_address[1]}"
    for k, v in old.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    srv.shutdown()


def _settings(seed: dict | None = None) -> PluginSettings:
    conf = {RID: {"seed": seed}} if seed else {}
    return PluginSettings.from_dict({"paths": [str(BUILTIN)], "select": {"llm": [RID]}, "config": conf})


async def _router(tmp_path, env=None, seed=None):
    mgr = PluginManager(_settings(seed), tmp_path, environ=env or {})
    await mgr.start()
    assert mgr.states[RID].status == "running", mgr.states[RID].error
    return mgr, mgr.states[RID].instance


async def test_seed_from_old_single_model(tmp_path, fake):
    mgr, r = await _router(tmp_path, env={"GALLINGS_LLM_API_KEY": "sk-good"}, seed={"base_url": fake + "/v1/", "model": "x1"})
    st = await r.api("state", {})
    assert [(m["name"], m["base_url"], m["model"]) for m in st["models"]] == [("我的模型", fake + "/v1", "x1")]
    assert st["main"] == st["models"][0]["id"] and st["models"][0]["usable"]
    res = await complete(r.chain_for("soul"), [{"role": "user", "content": "hi"}])
    assert res.text == "在呢·x1" and res.plugin == RID
    await mgr.stop()
    # 第二次启动不再重复导入
    mgr, r = await _router(tmp_path, env={"GALLINGS_LLM_API_KEY": "sk-other"}, seed={"base_url": fake, "model": "x1"})
    assert len((await r.api("state", {}))["models"]) == 1
    await mgr.stop()


async def test_no_seed_without_key(tmp_path, fake):
    mgr, r = await _router(tmp_path, seed={"base_url": fake, "model": "x1"})
    assert (await r.api("state", {}))["models"] == [] and r.chain_for("story") == []
    await mgr.stop()


async def test_crud_main_think_and_key_privacy(tmp_path, fake):
    mgr, r = await _router(tmp_path)
    a = await r.api("save", {"model": {"name": "快", "preset": "custom", "base_url": fake + "/a/chat/completions", "model": "fast"}, "api_key": "sk-good"})
    assert a["ok"] and a["models"][0]["base_url"] == fake + "/a" and a["models"][0]["think"] == "off"   # 误填完整路径也能用；默认思考关
    b = await r.api("save", {"model": {"name": "聪明", "base_url": fake + "/b", "model": "smart", "think": "high"}, "api_key": "sk-good"})
    ida, idb = a["id"], b["id"]
    st = b
    assert st["main"] == ida and "rules" not in st                     # 第一个加的自动成为当前模型；没有分配规则了
    blob = json.dumps(st, ensure_ascii=False)
    assert "sk-good" not in blob and all(m["key_set"] and m["key_tail"] == "" for m in st["models"])   # 短密钥连末 4 位都不给
    keyfile = tmp_path / "plugins" / RID / "keys.json"
    assert "sk-good" in keyfile.read_text() and "sk-good" not in (tmp_path / "plugins" / RID / "models.json").read_text()
    if os.name == "posix":
        assert stat.S_IMODE(keyfile.stat().st_mode) == 0o600

    # 每个用途都用当前模型
    for purpose in ("story", "soul", "chat", "cards", None):
        assert [x.ctx.profile for x in r.chain_for(purpose)] == [ida]
    assert (await complete(r.chain_for("chat"), [{"role": "user", "content": "x"}])).text == "在呢·fast"
    sent = _H.seen[-1]["req"]
    assert "reasoning_effort" not in sent and "thinking" not in sent    # 关 = 自定义服务不发思考参数

    await r.api("main", {"id": idb})
    assert (await complete(r.chain_for("soul"), [{"role": "user", "content": "x"}], max_tokens=50)).text == "在呢·smart"
    sent = _H.seen[-1]["req"]
    assert sent["reasoning_effort"] == "high" and sent["max_tokens"] == 50 + 8192   # 高：发 reasoning_effort，输出上限给思考留余量
    bad = await r.api("save", {"model": {"id": idb, "name": "聪明", "base_url": fake + "/b", "model": "smart", "think": "超高"}})
    assert next(m for m in bad["models"] if m["id"] == idb)["think"] == "off"

    # 删除当前模型：自动换到剩下的
    st = await r.api("delete", {"id": idb})
    assert st["main"] == ida and idb not in keyfile.read_text()

    # 编辑时不传密钥 = 不改；空字符串 = 清除 → 不再可用
    await r.api("save", {"model": {"id": ida, "name": "快2", "base_url": fake + "/a", "model": "fast"}})
    assert next(m for m in (await r.api("state", {}))["models"] if m["id"] == ida)["usable"]
    st = await r.api("save", {"model": {"id": ida, "name": "快2", "base_url": fake + "/a", "model": "fast"}, "api_key": ""})
    assert not next(m for m in st["models"] if m["id"] == ida)["usable"] and r.chain_for("story") == []
    await mgr.stop()


def test_think_params_per_provider():
    tp = _think_params()
    assert tp("https://api.deepseek.com", "off") == {"thinking": {"type": "disabled"}}
    assert tp("https://api.deepseek.com", "mid") == {"thinking": {"type": "enabled"}}
    assert tp("https://dashscope.aliyuncs.com/compatible-mode/v1", "off") == {"enable_thinking": False}
    assert tp("https://api.siliconflow.cn/v1", "high") == {"enable_thinking": True, "thinking_budget": 16384}
    assert tp("https://openrouter.ai/api/v1", "mid") == {"reasoning": {"effort": "medium"}}
    assert tp("https://openrouter.ai/api/v1", "off") == {"reasoning": {"enabled": False}}
    assert tp("https://api.moonshot.cn/v1", "high") == {}
    assert tp("https://api.openai.com/v1", "off") == {} and tp("http://127.0.0.1:11434/v1", "mid") == {"reasoning_effort": "medium"}


async def test_validation_test_and_remote_models(tmp_path, fake):
    mgr, r = await _router(tmp_path)
    assert not (await r.api("save", {"model": {"name": "x", "base_url": "", "model": ""}}))["ok"]
    # 弹窗里还没保存的草稿也能测
    ok = await r.api("test", {"model": {"base_url": fake, "model": "m", "think": "mid"}, "api_key": "sk-good"})
    assert ok["ok"] and "在呢" in ok["message"] and _H.seen[-1]["req"]["reasoning_effort"] == "medium"
    wrong = await r.api("test", {"model": {"base_url": fake, "model": "m"}, "api_key": "sk-bad"})
    assert not wrong["ok"] and "密钥不对" in wrong["message"]
    assert "API Key" in (await r.api("test", {"model": {"base_url": fake, "model": "m"}}))["message"]
    lst = await r.api("models", {"model": {"base_url": fake + "/v1"}, "api_key": "sk-good"})
    assert lst["ok"] and lst["models"] == ["m-a", "m-b"]
    # 本机地址不要求密钥
    loc = await r.api("save", {"model": {"name": "本机", "preset": "ollama", "base_url": "http://127.0.0.1:9/v1", "model": "q"}})
    assert loc["models"][0]["usable"] and loc["models"][0]["no_key"]
    assert (await r.api("rules", {}))["ok"] is False   # 分配规则已删除
    await mgr.stop()


async def test_runtime_chain_prefers_router_and_drops_legacy(tmp_path, fake):
    """Runtime.llm_chain：路由有模型时用路由的链，旧单模型插件不再兜底；路由空时退回旧插件。"""
    from server.runtime import Runtime

    cfg = {"server": {"data_dir": str(tmp_path)}, "game": {"chapter_dir": str(tmp_path / "none")},
           "plugins": {"paths": [str(BUILTIN)], "select": {"llm": [RID, "gallings.llm.openai-compat"]},
                       "config": {"gallings.llm.openai-compat": {"base_url": fake + "/legacy", "model": "old"}}}}
    rt = Runtime(cfg, environ={"GALLINGS_LLM_API_KEY": "sk-good"})
    await rt.start()
    try:
        ids = [getattr(p.ctx, "profile", p.ctx.plugin_id) for p in rt.llm_chain("story")]
        r = rt.plugin(RID)
        st = await r.api("state", {})
        assert len(st["models"]) == 1 and st["models"][0]["base_url"] == fake + "/legacy"   # 旧设置自动导入
        assert ids == [st["models"][0]["id"]]
        await r.api("delete", {"id": st["models"][0]["id"]})
        assert [p.ctx.plugin_id for p in rt.llm_chain("story")] == ["gallings.llm.openai-compat"]
    finally:
        await rt.stop()
