"""HTTP + WebSocket（PLAN §14.1）。只监听 127.0.0.1。

- ``GET /``                         跳转到 API 文档（旧播放器已移除）
- ``GET /cards.html``               建卡页
- ``WS  /ws?card=whale&mode=choice`` 一个连接 = 一个会话
- ``WS  /ws/replay?log=<id>&speed=1``（或 ``/ws?replay=<id>``） 录制回放演示模式：按原节奏重播一局，不调用模型
- ``GET /api/replays``              已录制的局（data_dir/sessions/*/events.jsonl）
- ``/api/cards*``                   卡列表 / 读取 / 校验 / AI 填卡 / 保存
- ``/api/report``                   编译报告
- ``/api/plugins``                  插件状态
- ``/api/agent/*``                  外部 Agent 端口（预留，默认关闭）
- ``WS  /ws/post_ending``、``/galagent`` 结局后聊天 GalAgent（gallings.tool.galagent，见 docs/design/galagent.md）
- ``GET /vn.html``                    作品页：玩 VN Studio 导出的游戏（窗口 / 全屏），手账停靠右侧栏
- ``/vn/{作品}/…``、``/api/vn/games``  作品文件（vn.games_dir，默认仓库根的 海风与布丁/）
- ``/api/vn/plugins``、``/vn_plugins/…`` 给作品用的 VN Studio 插件（vn-plugin/1）：GalAgent + content/vn_plugins/*.js
- ``/api/settings``                 网页设置（模型 / 密钥 / 记忆底座），存 data_dir，改完重启插件（见 server/api/settings.py）
- ``/__host/*``                     桌面与 Steam 宿主桥接口（见 server/api/host.py）
- ``WS  /ws/soul?card=whale``         灵枢外部端口 vn-soul/1：外部前端（VN Studio）的手账记忆 / 悄悄话
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse

from server.api import host, post_ending, settings
from server.api.guard import LOOPBACK, LocalOnlyGuard, NoCacheStaticFiles, _hostname
from server.api.settings import lingshu_path_problem
from server.cards import builder
from server.cards.validate import has_errors, validate_card
from server.recorder import read_log_full
from server.replay import ReplayPlayer, find_log, list_logs
from server.runtime import ROOT, Runtime, load_config
from server.session import TOOLS, Session, SessionOptions
from server.soul import SoulSession

__all__ = ["LOOPBACK", "LocalOnlyGuard", "VN_PLUGINS_DIR", "create_app", "lingshu_path_problem"]

log = logging.getLogger("gallings.api")
WEB = ROOT / "web"
NO_CACHE = {"Cache-Control": "no-cache"}


def VN_PLUGINS_DIR(r: Runtime) -> Path:  # noqa: N802
    """放给作品用的 VN Studio 插件（.js）的文件夹：vn.plugins_dir，默认 content/vn_plugins。"""
    raw = (r.config.get("vn") or {}).get("plugins_dir") or os.environ.get("GALLINGS_VN_PLUGINS_DIR") or "content/vn_plugins"
    d = Path(str(raw)).expanduser()
    resolved = d if d.is_absolute() else ROOT / d
    if not resolved.is_dir() and (ROOT / "game" / "vn_plugins").is_dir():
        return ROOT / "game" / "vn_plugins"
    return resolved


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
    bind_cfg = (getattr(runtime, "base_config", None) or {}) if runtime else load_config()
    bind = str((bind_cfg.get("server") or {}).get("host", "127.0.0.1"))
    app.add_middleware(LocalOnlyGuard, check_host=_hostname(bind) in LOOPBACK)

    def rt() -> Runtime:
        return rt_holder["rt"]

    @app.get("/")
    async def index() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"ok": True, "status": "ok", "service": "gallings"}

    @app.get("/vn.html")
    async def vn_page() -> FileResponse:
        return FileResponse(WEB / "vn.html", headers=NO_CACHE)

    @app.get("/cards.html")
    async def cards_page() -> FileResponse:
        return FileResponse(WEB / "cards.html", headers=NO_CACHE)

    app.mount("/static", NoCacheStaticFiles(directory=WEB), name="static")

    @app.get("/api/status")
    async def status() -> dict[str, Any]:
        r = rt()
        return {
            "llm": bool(r.llm_chain()),
            "memory": r.plugins.get("memory") is not None,
            "chapter": {"id": r.chapter["chapter_id"], "title": r.chapter["title"], "content_hash": r.chapter["content_hash"]},
            "default_card": r.game.get("default_card", "whale"),
            "default_mode": r.game.get("default_mode", "choice"),
            "reserved": {
                "cross_run_memory": bool(r.game.get("cross_run_memory")),
                "post_ending": (r.game.get("post_ending") or {}).get("mode", "off"),
                "agent_port": bool((r.game.get("agent_port") or {}).get("enabled")),
                "image": r.plugins.get("image") is not None,
                "tts": r.plugins.get("tts") is not None,
            },
        }

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
        enabled = bool((rt().game.get("agent_port") or {}).get("enabled"))
        return JSONResponse({"enabled": enabled, "tools": TOOLS})

    @app.post("/api/agent/call")
    async def agent_call(body: dict[str, Any]) -> JSONResponse:
        return JSONResponse({"ok": False, "error": "外部 Agent 端口是预留接口，Demo 未开放"}, 501)

    # 挂载子模块路由：结局后聊天、设置面板、桌面/Steam 宿主桥
    post_ending.mount(app, rt)
    settings.mount(app, rt)
    host.mount(app, rt)

    # ---------------------------------------------------------------- 录制回放演示模式（PLAN §2.1、§20）
    @app.get("/api/replays")
    async def replays() -> dict[str, Any]:
        r = rt()
        cur = r.chapter.get("content_hash")
        logs = list_logs(r.data_dir)
        for x in logs:
            x["current_chapter"] = bool(cur) and x["content_hash"] == cur
            x.pop("path", None)
            x.pop("chapter_path", None)
        return {"logs": logs}

    async def serve_replay(sock: WebSocket, log_id: str) -> None:
        r = rt()
        q = sock.query_params

        async def send(m: dict[str, Any]) -> None:
            await sock.send_text(json.dumps(m, ensure_ascii=False))

        path = find_log(r.data_dir, log_id)
        if not path:
            await send({"type": "error", "message": f"没有这一局录像：{log_id}"})
            await sock.close()
            return
        try:
            h, events, sent = read_log_full(path)
            player = ReplayPlayer(
                h, events, sent, send, log_id=log_id, speed=q.get("speed") or 1,
                max_gap=float(q.get("max_gap") or 8), paused=q.get("paused") in ("1", "true"),
                chapters=[r.chapter_path],
            )
        except (ValueError, OSError, KeyError) as e:
            await send({"type": "error", "message": f"不能重播：{e}"})
            await sock.close()
            return
        await player.hello()
        if (q.get("from") or "0").isdigit() and int(q.get("from") or 0) > 0:
            await player.jump(int(q["from"]))
        task = asyncio.get_running_loop().create_task(player.run())
        try:
            while True:
                raw = await sock.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await send({"type": "error", "message": "不是 JSON"})
                    continue
                await player.control(msg if isinstance(msg, dict) else {})
                if player.stopped:
                    break
        except WebSocketDisconnect:
            pass
        finally:
            player.stopped = True
            player._poke()
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task

    @app.websocket("/ws/replay")
    async def ws_replay(sock: WebSocket) -> None:
        await sock.accept()
        await serve_replay(sock, sock.query_params.get("log") or sock.query_params.get("replay") or "")

    # ---------------------------------------------------------------- 会话
    @app.websocket("/ws")
    async def ws(sock: WebSocket) -> None:
        await sock.accept()
        if sock.query_params.get("replay"):
            await serve_replay(sock, sock.query_params["replay"])
            return
        r = rt()
        if not getattr(r, "has_chapter", True):
            await sock.send_text(json.dumps({"type": "error", "message": "缺少剧本内容（config.yaml 的 game.vn_game 作品或 game.chapter_dir），引擎会话暂时不能用。"}, ensure_ascii=False))
            await sock.close()
            return
        q = sock.query_params
        card_id = q.get("card") or r.game.get("default_card", "whale")
        mode = q.get("mode") or r.game.get("default_mode", "choice")
        if mode == "ai" and not r.llm_chain():
            mode = "choice"

        async def send(m: dict[str, Any]) -> None:
            await sock.send_text(json.dumps(m, ensure_ascii=False))

        try:
            sess = Session(
                r,
                SessionOptions(
                    card_id=card_id, mode=mode, agm_fill=bool(r.game.get("agm_fill", True)),
                    honesty_gap_rule=bool(r.game.get("honesty_gap_rule", False)),
                    endings_seen=int(q.get("endings") or 0) if (q.get("endings") or "0").isdigit() else 0,
                ),
                send,
            )
        except KeyError:
            await send({"type": "error", "message": f"没有这张卡：{card_id}"})
            await sock.close()
            return
        await sess.hello()
        if not q.get("restore"):
            await sess.handle({"type": "start", "line_id": q["start"]} if q.get("start") else {"type": "advance"})
        try:
            while True:
                msg = json.loads(await sock.receive_text())
                await sess.handle(msg)
        except WebSocketDisconnect:
            pass
        finally:
            await sess.close()

    # ---------------------------------------------------------------- 作品（VN Studio 导出的游戏）
    @app.get("/api/vn/games")
    async def vn_games() -> dict[str, Any]:
        r = rt()
        return {"dir": str(r.games_dir), "games": r.games()}

    @app.get("/api/vn/plugins")
    async def vn_plugins() -> dict[str, Any]:
        r = rt()
        out = post_ending.vn_plugins(r)
        if r.game.get("source") == "vnstudio" and getattr(r, "has_chapter", False):
            out.insert(0, {"id": "gallings.galcore", "name": "galcore 引擎", "url": "/static/galcore.vnplugin.js"})
        d = VN_PLUGINS_DIR(r)
        if d.is_dir():
            out += [{"id": f.stem.removesuffix(".vnplugin"), "url": f"/vn_plugins/{f.name}"} for f in sorted(d.glob("*.js"))]
        return {"plugins": out}

    @app.get("/vn_plugins/{name}")
    async def vn_plugin_file(name: str) -> FileResponse:
        d = VN_PLUGINS_DIR(rt()).resolve()
        f = (d / name).resolve()
        if f.parent != d or f.suffix != ".js" or not f.is_file():
            raise HTTPException(404)
        return FileResponse(f, media_type="text/javascript", headers=NO_CACHE)

    @app.get("/vn/{game}/{path:path}")
    async def vn_file(game: str, path: str) -> FileResponse:
        root = rt().games_dir.resolve()
        if (root / "index.html").is_file() and game == root.name:
            base = root
        else:
            base = (root / game).resolve()
        f = (base / (path or "index.html")).resolve()
        allowed = base == root or base.parent == root
        if not allowed or base not in f.parents or not f.is_file():
            raise HTTPException(404)
        headers = NO_CACHE if f.suffix.lower() in {".html", ".js", ".css"} else None
        return FileResponse(f, headers=headers)

    @app.get("/art-assets/{path:path}")
    async def art_asset_file(path: str) -> FileResponse:
        """只读美术访问（作者用）：作品资源与 A素材库，其余一概拒绝。"""
        root = ROOT.resolve()
        allowed = [(root / "海风与布丁").resolve(), (root / "A素材库").resolve()]
        f = (root / path).resolve()
        images = {".png", ".jpg", ".jpeg", ".webp"}
        if not any(a in f.parents for a in allowed):
            raise HTTPException(404)
        if f.suffix.lower() not in images or not f.is_file():
            raise HTTPException(404)
        return FileResponse(f)

    # ---------------------------------------------------------------- 灵枢外部端口（VN Studio 手账）
    @app.websocket("/ws/soul")
    async def ws_soul(sock: WebSocket) -> None:
        await sock.accept()

        async def send(m: dict[str, Any]) -> None:
            await sock.send_text(json.dumps(m, ensure_ascii=False))

        card_id = sock.query_params.get("card") or rt().game.get("default_card", "whale")
        try:
            soul = SoulSession(rt(), card_id, send)
        except KeyError:
            await send({"type": "error", "message": f"没有这张卡：{card_id}（角色卡在内容包 content/cards/{card_id}.yaml 里，或在建卡页建一张同 id 的卡）；手账先用离线回复"})
            log.warning("/ws/soul：没有角色卡 %s，手账只能用离线回复", card_id)
            await sock.close()
            return
        try:
            while True:
                raw = await sock.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await send({"type": "error", "message": "不是 JSON"})
                    continue
                await soul.handle(msg)
        except WebSocketDisconnect:
            pass

    return app
