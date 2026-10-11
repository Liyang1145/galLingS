"""HTTP + WebSocket（PLAN §14.1）。只监听 127.0.0.1。

- ``GET /``                         跳转到 API 文档（旧播放器已移除）
- ``GET /cards.html``               建卡页
- ``WS  /ws?card=whale&mode=choice`` 一个连接 = 一个会话
- ``/api/cards*``                   卡列表 / 读取 / 校验 / AI 填卡 / 保存
- ``/api/report``                   编译报告
- ``/api/plugins``                  插件状态
- ``/api/agent/*``                  外部 Agent 端口（预留，默认关闭）
"""
from __future__ import annotations

import contextlib
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from server.cards import builder
from server.cards.validate import has_errors, validate_card
from server.runtime import ROOT, Runtime, load_config
from server.session import TOOLS, Session, SessionOptions

log = logging.getLogger("gallings.api")
WEB = ROOT / "web"


def create_app(runtime: Runtime | None = None) -> FastAPI:
    rt_holder: dict[str, Runtime] = {}

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        rt = runtime or Runtime(load_config())
        await rt.start()
        rt_holder["rt"] = rt
        yield
        await rt.stop()

    app = FastAPI(title="galLingS", lifespan=lifespan)

    def rt() -> Runtime:
        return rt_holder["rt"]

    @app.get("/")
    async def index() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    @app.get("/cards.html")
    async def cards_page() -> FileResponse:
        return FileResponse(WEB / "cards.html")

    app.mount("/static", StaticFiles(directory=WEB), name="static")

    @app.get("/api/status")
    async def status() -> dict[str, Any]:
        r = rt()
        return {"llm": bool(r.llm_chain()), "memory": r.plugins.get("memory") is not None,
                "chapter": {"id": r.chapter["chapter_id"], "title": r.chapter["title"], "content_hash": r.chapter["content_hash"]},
                "default_card": r.game.get("default_card", "whale"), "default_mode": r.game.get("default_mode", "choice"),
                "reserved": {"cross_run_memory": bool(r.game.get("cross_run_memory")),
                             "post_ending": (r.game.get("post_ending") or {}).get("mode", "off"),
                             "agent_port": bool((r.game.get("agent_port") or {}).get("enabled")),
                             "image": r.plugins.get("image") is not None, "tts": r.plugins.get("tts") is not None}}

    @app.get("/api/plugins")
    async def plugins() -> dict[str, Any]:
        return rt().plugins.report()

    @app.get("/api/report", response_class=PlainTextResponse)
    async def report() -> str:
        p = rt().chapter_path.parent / "report.md"
        return p.read_text(encoding="utf-8") if p.exists() else ""

    # ---------------------------------------------------------------- 角色卡
    @app.get("/api/cards")
    async def cards() -> list[dict[str, Any]]:
        return rt().cards.listing()

    @app.get("/api/cards/{card_id}")
    async def card(card_id: str) -> dict[str, Any]:
        try:
            c, _ = rt().cards.get(card_id)
        except KeyError:
            raise HTTPException(404, "没有这张卡")
        return c

    @app.post("/api/cards/validate")
    async def validate(body: dict[str, Any]) -> dict[str, Any]:
        f = validate_card(body, rt().chapter)
        return {"ok": not has_errors(f), "findings": [x.to_dict() for x in f]}

    @app.post("/api/cards/generate")
    async def generate(body: dict[str, Any]) -> JSONResponse:
        desc = str(body.get("description", "")).strip()
        if len(desc) < 10:
            return JSONResponse({"ok": False, "error": "描述太短，至少写一两句人设"}, 400)
        return JSONResponse(await builder.generate(desc[:3000], rt().llm_chain(), rt().chapter))

    @app.post("/api/cards")
    async def save(body: dict[str, Any]) -> JSONResponse:
        f = validate_card(body, rt().chapter)
        if has_errors(f):
            return JSONResponse({"ok": False, "findings": [x.to_dict() for x in f]}, 400)
        try:
            rt().cards.save(body)
        except ValueError as e:
            return JSONResponse({"ok": False, "error": str(e)}, 400)
        return JSONResponse({"ok": True, "id": body["id"], "findings": [x.to_dict() for x in f]})

    # ---------------------------------------------------------------- 预留接口
    @app.get("/api/agent/tools")
    async def agent_tools() -> JSONResponse:
        """外部 Agent 端口（PLAN §16）：工具注册表已就绪；调用端口默认关闭。"""
        enabled = bool((rt().game.get("agent_port") or {}).get("enabled"))
        return JSONResponse({"enabled": enabled, "tools": TOOLS})

    @app.post("/api/agent/call")
    async def agent_call(body: dict[str, Any]) -> JSONResponse:
        return JSONResponse({"ok": False, "error": "外部 Agent 端口是预留接口，Demo 未开放"}, 501)

    @app.post("/api/post_ending/chat")
    async def post_ending_chat(body: dict[str, Any]) -> JSONResponse:
        return JSONResponse({"ok": False, "error": "结局后自由聊天是预留接口（PLAN §16）"}, 501)

    # ---------------------------------------------------------------- 会话
    @app.websocket("/ws")
    async def ws(sock: WebSocket) -> None:
        await sock.accept()
        r = rt()
        q = sock.query_params
        card_id = q.get("card") or r.game.get("default_card", "whale")
        mode = q.get("mode") or r.game.get("default_mode", "choice")
        if mode == "ai" and not r.llm_chain():
            mode = "choice"

        async def send(m: dict[str, Any]) -> None:
            await sock.send_text(json.dumps(m, ensure_ascii=False))

        try:
            sess = Session(r, SessionOptions(card_id=card_id, mode=mode, agm_fill=bool(r.game.get("agm_fill", True)),
                                             honesty_gap_rule=bool(r.game.get("honesty_gap_rule", False))), send)
        except KeyError:
            await send({"type": "error", "message": f"没有这张卡：{card_id}"})
            await sock.close()
            return
        await sess.hello()
        await sess.handle({"type": "advance"})
        try:
            while True:
                msg = json.loads(await sock.receive_text())
                await sess.handle(msg)
        except WebSocketDisconnect:
            pass
        finally:
            await sess.close()

    return app
