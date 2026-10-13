"""HTTP + WebSocket（PLAN §14.1）。只监听 127.0.0.1。

- ``GET /``                         跳转到 API 文档（旧播放器已移除）
- ``GET /cards.html``               建卡页
- ``WS  /ws?card=whale&mode=choice`` 一个连接 = 一个会话
- ``/api/cards*``                   卡列表 / 读取 / 校验 / AI 填卡 / 保存
- ``/api/report``                   编译报告
- ``/api/plugins``                  插件状态
- ``/api/agent/*``                  外部 Agent 端口（预留，默认关闭）
- ``WS  /ws/post_ending``、``/galagent`` 结局后聊天 GalAgent（gallings.tool.galagent，见 docs/galagent.md）
- ``GET /vn.html``                    作品页：玩 VN Studio 导出的游戏（窗口 / 全屏），手账停靠右侧栏
- ``/vn/{作品}/…``、``/api/vn/games``  作品文件（vn.games_dir，默认 content/vn）
- ``/api/vn/plugins``、``/vn_plugins/…`` 给作品用的 VN Studio 插件（vn-plugin/1）：GalAgent + content/vn_plugins/*.js
- ``/api/settings``                 网页设置（模型 / 密钥 / 记忆底座），存 data_dir，改完重启插件
- ``WS  /ws/soul?card=whale``         灵枢外部端口 vn-soul/1：外部前端（VN Studio）的手账记忆 / 悄悄话
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

from server.api import post_ending
from server.cards import builder
from server.cards.validate import has_errors, validate_card
from server.runtime import ROOT, Runtime, load_config
from server.session import TOOLS, Session, SessionOptions
from server.soul import SoulSession

log = logging.getLogger("gallings.api")
WEB = ROOT / "web"


def VN_PLUGINS_DIR(r: Runtime) -> Path:  # noqa: N802
    """放给作品用的 VN Studio 插件（.js）的文件夹：vn.plugins_dir，默认 content/vn_plugins。"""
    d = Path(str((r.config.get("vn") or {}).get("plugins_dir") or "content/vn_plugins")).expanduser()
    return d if d.is_absolute() else ROOT / d



def lingshu_path_problem(path: str) -> str:
    """灵枢路径要指向 dsh-memory 检出目录（里面有 md_cg/mcp_server.py）。不对就返回给人看的原因。"""
    from pathlib import Path
    if not path.strip():
        return "没填 dsh-memory 路径，记忆设置没改。"
    p = Path(path.strip().strip('"'))
    if not p.is_dir():
        return f"找不到文件夹 {p}，记忆设置没改。"
    if (p / "md_cg" / "mcp_server.py").is_file():
        return ""
    if any(p.glob("*/md_cg/mcp_server.py")):
        sub = next(p.glob("*/md_cg/mcp_server.py")).parent.parent
        return f"灵枢在下一层：请填 {sub}，记忆设置没改。"
    return "这里没有灵枢（找不到 md_cg\\mcp_server.py），记忆设置没改。先下载 dsh-memory（github.com/FuRongJun-1999/dsh-memory），再填它的文件夹。"

LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def _hostname(v: str) -> str:
    """'127.0.0.1:8765' / '[::1]:8765' / 'http://localhost:8765' → 主机名（小写，不带端口）。"""
    v = v.strip().lower()
    if "://" in v:
        v = v.split("://", 1)[1]
    v = v.split("/", 1)[0]
    if v.startswith("["):
        return v[1:].split("]", 1)[0]
    return v.rsplit(":", 1)[0] if v.count(":") == 1 else v


class LocalOnlyGuard:
    """本机服务的门卫（PLAN §17.4）：/api/settings 没有登录，靠它挡住别的网站。

    - Host 必须是本机名：挡 DNS 重绑定（坏网站把自己的域名解析到 127.0.0.1，就成了“同源”）。
      config.yaml 里 server.host 改成非本机地址（自己要开局域网）时不查 Host。
    - 有 Origin 时必须是本机网页：挡别的网站在后台 POST /api/settings（改服务地址偷密钥）或连 WebSocket 花你的模型额度。
      /ws/soul 额外放行 Origin: null —— 双击打开的 VN Studio 游戏（file://）要连灵枢端口。
    """

    def __init__(self, app: Any, check_host: bool = True) -> None:
        self.app, self.check_host = app, check_host

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope["type"] in ("http", "websocket"):
            h = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope.get("headers") or []}
            bad = ""
            if self.check_host and _hostname(h.get("host", "")) not in LOOPBACK:
                bad = "host"
            origin = h.get("origin")
            if origin is not None and not bad:
                null_ok = scope["type"] == "websocket" and scope.get("path") == "/ws/soul"
                same = origin.lower().split("://", 1)[-1].rstrip("/") == h.get("host", "").lower()  # 同源（开了局域网时手机访问）
                if not ((origin == "null" and null_ok) or same or _hostname(origin) in LOOPBACK):
                    bad = "origin"
            if bad:
                log.warning("拒绝非本机请求（%s）：%s %s", bad, h.get("host", ""), origin or "")
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                    return
                await PlainTextResponse("forbidden: galLingS 只接受本机网页的请求", status_code=403)(scope, receive, send)
                return
        await self.app(scope, receive, send)


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
    bind_cfg = (getattr(runtime, "base_config", None) or {}) if runtime else load_config()  # 测试替身可能没有配置：按默认 127.0.0.1
    bind = str((bind_cfg.get("server") or {}).get("host", "127.0.0.1"))
    app.add_middleware(LocalOnlyGuard, check_host=_hostname(bind) in LOOPBACK)

    def rt() -> Runtime:
        return rt_holder["rt"]

    @app.get("/")
    async def index() -> RedirectResponse:
        return RedirectResponse(url="/docs")

    @app.get("/vn.html")
    async def vn_page() -> FileResponse:
        return FileResponse(WEB / "vn.html")

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

    # 结局后自由聊天（PLAN §16）：/ws/post_ending、/api/post_ending/*、/galagent，由 gallings.tool.galagent 插件提供实现
    post_ending.mount(app, rt)

    # ---------------------------------------------------------------- 会话
    @app.websocket("/ws")
    async def ws(sock: WebSocket) -> None:
        await sock.accept()
        r = rt()
        if not getattr(r, "has_chapter", True):
            await sock.send_text(json.dumps({"type": "error", "message": "缺少剧本内容包 content/scripts/ch01，AI 剧本会话暂时不能用。作品页 /vn.html 里的作品可以正常玩。"}, ensure_ascii=False))
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

    # ---------------------------------------------------------------- 作品（VN Studio 导出的游戏）+ 网页设置
    @app.get("/api/vn/games")
    async def vn_games() -> dict[str, Any]:
        r = rt()
        return {"dir": str(r.games_dir), "games": r.games()}

    @app.get("/api/vn/plugins")
    async def vn_plugins() -> dict[str, Any]:
        """作品页里的游戏（托管模式）启动时来取：galLingS 提供给它的 VN Studio 插件。玩家可以在游戏的“插件”面板里停用。"""
        r = rt()
        out = post_ending.vn_plugins(r)
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
        return FileResponse(f, media_type="text/javascript")

    @app.get("/vn/{game}/{path:path}")
    async def vn_file(game: str, path: str) -> FileResponse:
        root = rt().games_dir.resolve()
        base = (root / game).resolve()
        f = (base / (path or "index.html")).resolve()
        # 作品名本身也可能是 ".." 或 Windows 盘符 "C:"：作品文件夹必须正好在 games_dir 下一层，文件必须在作品文件夹里
        if base.parent != root or base not in f.parents or not f.is_file():
            raise HTTPException(404)
        return FileResponse(f)

    @app.get("/api/settings")
    async def get_settings() -> dict[str, Any]:
        r = rt()
        return {**r.settings.public(r.config, r.base_environ), "llm_ready": bool(r.llm_chain()),
                "memory_ready": r.plugins.get("memory") is not None,
                "memory_active": getattr(getattr(r.plugins.get("memory"), "ctx", None), "plugin_id", ""),
                "failed": {k: v for k, v in r.plugins.failed().items()}}

    @app.post("/api/settings")
    async def post_settings(body: dict[str, Any]) -> dict[str, Any]:
        r = rt()
        warn = ""
        mem = body.get("memory") if isinstance(body.get("memory"), dict) else None
        if mem and mem.get("use") == "lingshu":
            warn = lingshu_path_problem(str(mem.get("dsh_memory_path") or ""))
            if warn:
                body = {k: v for k, v in body.items() if k != "memory"}  # 其余照存，记忆设置不动
        r.settings.save(body)
        await r.reload_plugins()
        return {**await get_settings(), "warn": warn}

    @app.post("/api/settings/test")
    async def test_llm() -> dict[str, Any]:
        """用当前设置真调一次模型：回一句话就算通。"""
        from server.director.llm import complete
        r = rt()
        if not r.llm_chain():
            return {"ok": False, "message": "没有可用的模型（没填密钥，或插件没启动）"}
        try:
            res = await complete(r.llm_chain(), [{"role": "user", "content": "只回复两个字：在呢"}], timeout=30, max_tokens=32)
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": str(e)[:200]}
        return {"ok": bool(res.text.strip()), "message": res.text.strip()[:40] or "模型连上了，但只返回了空内容（可能是思考模式把字数用完了）"}

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
