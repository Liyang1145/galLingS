"""结局后自由聊天端口（PLAN §16 ``post_ending``）。

引擎只做“插座”：找到实现了 ``open_post_ending()`` 的插件（默认 ``gallings.tool.galagent``），
把 WebSocket 消息转给它开的会话。协议 galagent/1，见 docs/design/galagent.md。

- ``WS   /ws/post_ending[?card=<id>]``   一个连接 = 一个聊天窗口
- ``GET  /api/post_ending/info``         是否可用、提供者、工具清单
- ``POST /api/post_ending/chat``         兼容 VN Studio 的 vn-agent/1（一问一答，不流式；需要确认的工具一律拒绝）
- ``GET  /galagent``                     独立聊天页（galgame 画面，插件 web/ 目录）
- ``GET  /galagent/assets/<路径>``        素材库 素材库 里的图片（背景、立绘）

安全：只监听 127.0.0.1 还不够——任何网页都能连本机 WebSocket。所以除了本服务自己的页面（Host 与 Origin
都是 127.0.0.1/localhost:端口），其它来源（含 file:// 打开的 VN Studio，Origin 为 "null"）必须带令牌。
令牌在 ``game.post_ending.token``，留空则自动生成并存到 ``<data_dir>/post_ending_token.txt``。

也可以不装 Rust 核心、单独跑这个端口（给只用 VN Studio 的作者）::

    python -m server.api.post_ending --config config.galagent.example.yaml
"""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response

log = logging.getLogger("gallings.post_ending")


def _cfg(rt: Any) -> dict[str, Any]:
    return (getattr(rt, "game", None) or {}).get("post_ending") or {}


def enabled(rt: Any) -> bool:
    return str(_cfg(rt).get("mode", "off")) != "off"


def find_provider(rt: Any) -> tuple[str, Any] | None:
    want = _cfg(rt).get("provider")
    for pid in rt.plugins.settings.multi.get("tool", []):
        st = rt.plugins.states.get(pid)
        if st is None or st.status != "running" or not hasattr(st.instance, "open_post_ending"):
            continue
        if want and pid != want:
            continue
        return pid, st.instance
    return None


def get_token(rt: Any) -> str:
    tok = str(_cfg(rt).get("token") or "").strip()
    if tok:
        return tok
    p = Path(rt.data_dir) / "post_ending_token.txt"
    if p.is_file() and p.read_text(encoding="utf-8").strip():
        return p.read_text(encoding="utf-8").strip()
    tok = secrets.token_urlsafe(18)
    p.write_text(tok, encoding="utf-8")
    return tok


def _local_host(host: str) -> bool:
    h = host.split("]")[0] + "]" if host.startswith("[") else host.rsplit(":", 1)[0]
    return h in ("127.0.0.1", "localhost", "[::1]")


def same_origin(headers: Any) -> bool:
    host, origin = headers.get("host", ""), headers.get("origin")
    if not _local_host(host):
        return False  # 防 DNS rebinding：Host 必须是本机名
    return origin in (f"http://{host}", f"https://{host}")


def token_ok(rt: Any, headers: Any, given: str | None) -> bool:
    if same_origin(headers) or _cfg(rt).get("require_token") is False:
        return True
    return bool(given) and secrets.compare_digest(str(given), get_token(rt))


def _card_character(rt: Any, provider: Any, card_id: str | None) -> dict[str, Any] | None:
    if not card_id or not hasattr(rt, "cards"):
        return None
    try:
        card, _ = rt.cards.get(card_id)
    except Exception:  # noqa: BLE001
        return None
    return provider.character_from_card(card) if hasattr(provider, "character_from_card") else None


def _cors(resp: Response, origin: str | None) -> Response:
    resp.headers["Access-Control-Allow-Origin"] = origin or "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-GalAgent-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Vary"] = "Origin"
    return resp


def mount(app: FastAPI, get_rt: Callable[[], Any]) -> None:
    @app.websocket("/ws/post_ending")
    async def ws_post_ending(sock: WebSocket) -> None:
        await sock.accept()
        rt = get_rt()

        async def send(m: dict[str, Any]) -> None:
            await sock.send_text(json.dumps(m, ensure_ascii=False, default=str))

        if not enabled(rt):
            await send({"type": "error", "fatal": True, "message": "结局后聊天未开启（game.post_ending.mode = off）"})
            await sock.close()
            return
        prov = find_provider(rt)
        if prov is None:
            await send({"type": "error", "fatal": True,
                        "message": "没有可用的结局后聊天插件（把 gallings.tool.galagent 加进 plugins.tools）"})
            await sock.close()
            return
        pid, provider = prov
        session = provider.open_post_ending(llm_chain=rt.llm_chain(), send=send, manager=rt.plugins)
        authed = False
        try:
            while True:
                try:
                    msg = json.loads(await sock.receive_text())
                except json.JSONDecodeError:
                    await send({"type": "error", "message": "不是 JSON"})
                    continue
                if not authed:
                    if msg.get("type") != "hello":
                        await send({"type": "error", "message": "请先发送 hello"})
                        continue
                    if not token_ok(rt, sock.headers, msg.get("token")):
                        await send({"type": "error", "fatal": True, "code": "auth",
                                    "message": "令牌不对：请在设置里填 GalAgent 令牌（见服务端 post_ending_token.txt）"})
                        break
                    authed = True
                    ch = _card_character(rt, provider, msg.get("card") or sock.query_params.get("card"))
                    if ch and not (msg.get("character") or {}).get("persona"):
                        msg = {**msg, "character": {**ch, **{k: v for k, v in (msg.get("character") or {}).items() if v}}}
                await session.handle(msg)
        except WebSocketDisconnect:
            pass
        finally:
            await session.close()

    @app.options("/api/post_ending/{rest:path}")
    async def pe_options(rest: str, request: Request) -> Response:
        return _cors(Response(status_code=204), request.headers.get("origin"))

    @app.get("/api/post_ending/info")
    async def pe_info(request: Request) -> Response:
        rt = get_rt()
        prov = find_provider(rt)
        tools: list[dict[str, Any]] = []
        if prov and token_ok(rt, request.headers, request.headers.get("x-galagent-token")):
            from_reg = await _registry_entries(rt, prov[1])
            tools = [{"name": e.spec.name, "effect": e.spec.effect, "policy": e.policy, "source": e.source} for e in from_reg]
        return _cors(JSONResponse({"enabled": enabled(rt), "provider": prov[0] if prov else None,
                                   "mode": _cfg(rt).get("mode", "off"), "llm": bool(rt.llm_chain()),
                                   "protocol": "galagent/1", "tools": tools}), request.headers.get("origin"))

    @app.post("/api/post_ending/chat")
    async def pe_chat(request: Request) -> Response:
        """vn-agent/1 兼容：VN Studio 的 http 大脑可以直接指到这里。"""
        rt = get_rt()
        origin = request.headers.get("origin")
        body = await request.json()
        if not enabled(rt) or (prov := find_provider(rt)) is None:
            return _cors(JSONResponse({"text": "（结局后聊天未开启）", "error": "disabled"}, 501), origin)
        if not token_ok(rt, request.headers, request.headers.get("x-galagent-token") or body.get("token")):
            return _cors(JSONResponse({"text": "（令牌不对）", "error": "auth"}, 401), origin)
        res = await run_once(rt, prov[1], body)
        return _cors(JSONResponse(res), origin)

    @app.get("/galagent")
    async def pe_page() -> Response:
        prov = find_provider(get_rt())
        root = _web_root(get_rt(), prov)
        if root is None or not (root / "chat.html").is_file():
            return JSONResponse({"error": "没有 galagent 前端"}, 404)
        return FileResponse(root / "chat.html")

    @app.get("/galagent/assets/{rel:path}")
    async def pe_assets(rel: str) -> Response:
        """galLingS 素材库：独立聊天页的背景、立绘。"""
        from server.runtime import ROOT
        base = (ROOT / "素材库").resolve()
        f = (base / rel).resolve()
        if base not in f.parents or not f.is_file() or f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            return Response(status_code=404)
        return FileResponse(f)

    @app.get("/galagent/{name}")
    async def pe_static(name: str) -> Response:
        root = _web_root(get_rt(), find_provider(get_rt()))
        if root is None or "/" in name or "\\" in name or name.startswith("."):
            return Response(status_code=404)
        f = root / name
        if not f.is_file():
            return Response(status_code=404)
        return FileResponse(f, media_type="text/javascript") if f.suffix == ".js" else FileResponse(f)


def vn_plugins(rt: Any) -> list[dict[str, Any]]:
    """GalAgent 开着时，把它的 VN Studio 插件（web/galagent.vnplugin.js）提供给作品页里的游戏。"""
    try:
        if not enabled(rt):
            return []
        root = _web_root(rt, find_provider(rt))
    except Exception:  # noqa: BLE001
        return []
    if root is None or not (root / "galagent.vnplugin.js").is_file():
        return []
    return [{"id": "gallings.galagent", "name": "GalAgent", "url": "/galagent/galagent.vnplugin.js"}]


def _web_root(rt: Any, prov: tuple[str, Any] | None) -> Path | None:
    if prov is None:
        return None
    return Path(rt.plugins.states[prov[0]].manifest.root) / "web"


async def _registry_entries(rt: Any, provider: Any) -> list[Any]:
    sess = provider.open_post_ending(llm_chain=[], send=_noop, manager=rt.plugins)
    return await sess.registry.entries()


async def _noop(_m: dict[str, Any]) -> None:
    return None


async def run_once(rt: Any, provider: Any, body: dict[str, Any]) -> dict[str, Any]:
    """vn-agent/1 请求 → 跑一轮 → {text, emotion, set, end, work}。"""
    events: list[dict[str, Any]] = []
    done = asyncio.Event()
    holder: dict[str, Any] = {}

    async def send(m: dict[str, Any]) -> None:
        events.append(m)
        if m["type"] == "approval_required":   # HTTP 没法等玩家点按钮：一律拒绝
            asyncio.get_running_loop().call_soon(
                lambda: asyncio.ensure_future(holder["s"].handle({"type": "approve", "call_id": m["call_id"], "allow": False})))
        if m["type"] in ("turn_end",) or (m["type"] == "error" and m.get("fatal")):
            done.set()

    s = provider.open_post_ending(llm_chain=rt.llm_chain(), send=send, manager=rt.plugins)
    holder["s"] = s
    ch = body.get("character") or {}
    scene = body.get("scene") or {}
    hist = list(body.get("history") or [])
    if hist and hist[-1].get("role") == "player":
        hist = hist[:-1]
    await s.handle({"type": "hello", "character": ch, "history": hist,
                    "context": {"goal": scene.get("goal"), "vars": body.get("vars"), "story": scene.get("setup")}})
    await s.handle({"type": "user", "text": str(body.get("input", ""))})
    try:
        await asyncio.wait_for(done.wait(), timeout=float((getattr(provider, "ctx", None) and
                                                           provider.ctx.config.get("turn_timeout_s")) or 300) + 5)
    except asyncio.TimeoutError:
        pass
    await s.close()
    end = next((e for e in reversed(events) if e["type"] == "turn_end"), {})
    emo = next((e["name"] for e in reversed(events) if e["type"] == "emotion"), "")
    err = next((e["message"] for e in events if e["type"] == "error"), None)
    return {"text": end.get("reply") or (f"（{err}）" if err else "……"), "emotion": emo, "set": "", "end": False,
            "work": {"ms": end.get("ms"), "steps": end.get("steps"), "tool_calls": end.get("tool_calls"),
                     "events": [e for e in events if e["type"] in ("step_start", "step_end", "tool_start", "tool_end")]}}


# ---------------------------------------------------------------------- 独立运行（不需要 galcore）
class _MiniRuntime:
    def __init__(self, config: dict[str, Any]) -> None:
        import os

        from server.plugins import PluginManager, PluginSettings
        from server.runtime import ROOT

        srv = config.get("server") or {}
        self.data_dir = Path(os.path.expanduser(str(srv.get("data_dir", "~/.gallings"))))
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.game = config.get("game") or {}
        self.plugins = PluginManager(PluginSettings.from_dict(config.get("plugins"), base_dir=ROOT), self.data_dir)

    def llm_chain(self) -> list[Any]:
        from server.plugins import LLMPlugin
        return [p for p in self.plugins.chain("llm") if isinstance(p, LLMPlugin)]


def create_standalone_app(config: dict[str, Any]) -> FastAPI:
    import contextlib

    holder: dict[str, Any] = {}

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        rt = _MiniRuntime(config)
        await rt.plugins.start()
        for pid, err in rt.plugins.failed().items():
            log.warning("插件未启用 %s：%s", pid, err)
        holder["rt"] = rt
        log.warning("GalAgent 令牌（file:// 打开的 VN Studio 要填）：%s", get_token(rt))
        yield
        await rt.plugins.stop()

    app = FastAPI(title="galLingS post_ending", lifespan=lifespan)
    mount(app, lambda: holder["rt"])
    return app


def main() -> None:
    import argparse

    import uvicorn
    import yaml

    from server.runtime import load_config

    ap = argparse.ArgumentParser(description="只跑结局后聊天端口（GalAgent），不需要 Rust 核心")
    ap.add_argument("--config", type=Path)
    ap.add_argument("--port", type=int)
    a = ap.parse_args()
    cfg = yaml.safe_load(a.config.read_text(encoding="utf-8")) if a.config else load_config()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    srv = cfg.get("server") or {}
    uvicorn.run(create_standalone_app(cfg), host=srv.get("host", "127.0.0.1"), port=a.port or int(srv.get("port", 8765)))


if __name__ == "__main__":
    main()
