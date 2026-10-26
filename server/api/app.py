"""旧制作/独立聊天的本机辅助服务，不运行剧情或生成 OP。

保留角色卡、插件/模型/记忆设置、旧制作静态文件与新作者源只读投影、
/ws/soul、/ws/post_ending 及 /galagent。旧 /ws、/ws/replay、
/api/replays、/api/report 和剧情 Agent 工具端口已退役。
正式游戏只使用共享 TypeScript 本体，不连接此服务。
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from server.api import post_ending
from server.cards import builder
from server.cards.validate import has_errors, validate_card
from server.runtime import ROOT, Runtime, load_config
from server.soul import SoulSession

log = logging.getLogger("gallings.api")
WEB = ROOT / "web"


def VN_PLUGINS_DIR(r: Runtime) -> Path:  # noqa: N802
    """放给作品用的 VN Studio 插件（.js）的文件夹：vn.plugins_dir，默认 content/vn_plugins。"""
    raw = (r.config.get("vn") or {}).get("plugins_dir") or os.environ.get("GALLINGS_VN_PLUGINS_DIR") or "content/vn_plugins"
    d = Path(str(raw)).expanduser()
    resolved = d if d.is_absolute() else ROOT / d
    if not resolved.is_dir() and (ROOT / "game" / "vn_plugins").is_dir():
        return ROOT / "game" / "vn_plugins"
    return resolved



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

LOOPBACK = {"127.0.0.1", "localhost", "::1", "app.localhost"}


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
        return {"purpose": "legacy-authoring-and-chat", "llm": bool(r.llm_chain()),
                "memory": r.plugins.get("memory") is not None,
                "default_card": r.game.get("default_card", "whale"),
                "post_ending": (r.game.get("post_ending") or {}).get("mode", "off"),
                "image": r.plugins.get("image") is not None, "tts": r.plugins.get("tts") is not None}

    @app.get("/api/plugins")
    async def plugins() -> dict[str, Any]:
        return rt().plugins.report()

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
        f = validate_card(body)
        return {"ok": not has_errors(f), "findings": [x.to_dict() for x in f]}

    @app.post("/api/cards/generate")
    async def generate(body: dict[str, Any]) -> JSONResponse:
        desc = str(body.get("description", "")).strip()
        if len(desc) < 10:
            return JSONResponse({"ok": False, "error": "描述太短，至少写一两句人设"}, 400)
        return JSONResponse(await builder.generate(desc[:3000], rt().llm_chain()))

    @app.post("/api/cards")
    async def save(body: dict[str, Any]) -> JSONResponse:
        f = validate_card(body)
        if has_errors(f):
            return JSONResponse({"ok": False, "findings": [x.to_dict() for x in f]}, 400)
        try:
            rt().cards.save(body)
        except ValueError as e:
            return JSONResponse({"ok": False, "error": str(e)}, 400)
        return JSONResponse({"ok": True, "id": body["id"], "findings": [x.to_dict() for x in f]})

    # 结局后自由聊天（PLAN §16）：/ws/post_ending、/api/post_ending/*、/galagent，由 gallings.tool.galagent 插件提供实现
    post_ending.mount(app, rt)

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

    @app.get("/vn/{game}/{path:path}", response_model=None)
    async def vn_file(game: str, path: str) -> FileResponse | PlainTextResponse:
        root = rt().games_dir.resolve()
        if (root / "index.html").is_file() and game == root.name:
            base = root  # 单作品：games_dir 自己就是作品目录
        else:
            base = (root / game).resolve()
        f = (base / (path or "index.html")).resolve()
        # 作品名本身也可能是 ".." 或 Windows 盘符 "C:"：
        # 作品目录只能是 games_dir 本身（单作品）或它下一层，且文件必须在作品目录里
        allowed = base == root or base.parent == root
        # Retained legacy editor/export only: project data is generated in memory
        # from the sole chapter source, never from a second writable game.js.
        if allowed and base == (ROOT / "海风与布丁").resolve() and path == "game.js":
            from tools.author_project import current_project
            try:
                project = await asyncio.to_thread(current_project)
            except (ValueError, KeyError, TypeError, OSError):
                return PlainTextResponse("throw new Error('分章作者源读取失败，请检查作者文件或未完成事务');",
                                         status_code=409, media_type="text/javascript",
                                         headers={"Cache-Control": "no-store"})
            data = json.dumps(project, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
            return PlainTextResponse("window.VN_GAME = " + data + ";", media_type="text/javascript",
                                     headers={"Cache-Control": "no-store"})
        if not allowed or base not in f.parents or not f.is_file():
            raise HTTPException(404)
        return FileResponse(f)

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

    @app.get("/api/settings")
    async def get_settings() -> dict[str, Any]:
        r = rt()
        rep = r.plugins.report()
        return {**r.settings.public(r.config, r.base_environ), "llm_ready": bool(r.llm_chain()),
                "memory_ready": r.plugins.get("memory") is not None,
                "memory_active": getattr(getattr(r.plugins.get("memory"), "ctx", None), "plugin_id", ""),
                "tools": rep.get("tools") or {},
                "failed": {k: v for k, v in r.plugins.failed().items()}}

    @app.post("/api/settings")
    async def post_settings(body: dict[str, Any]) -> dict[str, Any]:
        r = rt()
        warn = ""
        mem = body.get("memory") if isinstance(body.get("memory"), dict) else None
        if mem and mem.get("use") == "lingshu":
            raw_dsh = str(mem.get("dsh_memory_path") or "").strip()
            if raw_dsh:
                warn = lingshu_path_problem(raw_dsh)
                if warn:
                    body = {k: v for k, v in body.items() if k != "memory"}  # 其余照存，记忆设置不动
        r.settings.save(body)
        await r.reload_plugins()
        return {**await get_settings(), "warn": warn}

    # ---------------------------------------------------------------- 桌面 / Steam 宿主桥兼容接口（/__host/*）
    SAVE_KINDS = ("slots", "global", "prefs", "read", "plugins")

    def _host_save_dir() -> Path:
        env_dir = os.environ.get("GALLINGS_SAVE_DIR")
        d = Path(env_dir) if env_dir else (rt().data_dir / "saves")
        d.mkdir(parents=True, exist_ok=True)
        return d

    @app.get("/__host/info")
    async def host_info() -> dict[str, Any]:
        r = rt()
        sdir = _host_save_dir()
        return {
            "ok": True,
            "steam": True,
            "full_backend": True,
            "platform": sys.platform,
            "save_dir": str(sdir),
            "config_dir": str(r.data_dir),
            "workspace_dir": str(r.data_dir / "plugins" / "gallings.tool.galagent" / "workspace"),
        }

    @app.get("/__host/saves")
    async def host_get_saves() -> dict[str, Any]:
        sdir = _host_save_dir()
        data: dict[str, Any] = {}
        for k in SAVE_KINDS:
            f = sdir / f"{k}.json"
            if f.is_file():
                with contextlib.suppress(OSError, ValueError):
                    data[k] = json.loads(f.read_text(encoding="utf-8"))
        return {"ok": True, "save_dir": str(sdir), "data": data}

    @app.post("/__host/saves")
    async def host_post_saves(body: dict[str, Any]) -> dict[str, Any]:
        sdir = _host_save_dir()
        batch = body.get("batch") if isinstance(body.get("batch"), dict) else body
        for k, v in batch.items():
            if k in SAVE_KINDS:
                tmp = sdir / f"{k}.json.tmp"
                target = sdir / f"{k}.json"
                tmp.write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding="utf-8")
                tmp.replace(target)
        return {"ok": True, "save_dir": str(sdir)}

    @app.get("/__host/llm")
    async def host_get_llm() -> dict[str, Any]:
        s = await get_settings()
        llm = s["llm"]
        return {
            "ok": True,
            "full_backend": True,
            "provider": llm.get("provider", "openai-compat"),
            "providers": llm.get("providers", []),
            "base_url": llm["base_url"],
            "model": llm["model"],
            "has_key": llm["key_set"],
            "key_set": llm["key_set"],
            "key_tail": llm["key_tail"],
            "llm_ready": s["llm_ready"],
            "memory": s["memory"],
            "memory_ready": s["memory_ready"],
            "memory_active": s["memory_active"],
            "tools": s["tools"],
        }

    @app.post("/__host/llm")
    async def host_post_llm(body: dict[str, Any]) -> dict[str, Any]:
        patch: dict[str, Any] = {"llm": {}}
        for k in ("provider", "base_url", "model"):
            if body.get(k):
                patch["llm"][k] = str(body[k]).strip()
        if body.get("clear_key") or body.get("api_key") == "__clear__":
            patch["llm"]["api_key"] = ""
        elif body.get("api_key"):
            patch["llm"]["api_key"] = str(body["api_key"]).strip()
        if isinstance(body.get("memory"), dict):
            patch["memory"] = body["memory"]
        await post_settings(patch)
        return await host_get_llm()

    @app.post("/__host/window")
    async def host_window(body: dict[str, Any]) -> dict[str, Any]:
        action = str(body.get("action") or "")
        sdir = _host_save_dir()
        if action == "open_save_dir":
            with contextlib.suppress(Exception):
                if sys.platform.startswith("win"):
                    subprocess.Popen(["explorer.exe", str(sdir)])
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", str(sdir)])
                else:
                    subprocess.Popen(["xdg-open", str(sdir)])
            return {"ok": True, "save_dir": str(sdir)}
        return {"ok": False, "delegate": True}

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
