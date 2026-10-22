"""本机安全门卫与无缓存静态资源服务（PLAN §17.4）。"""
from __future__ import annotations

import logging
from typing import Any

from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

log = logging.getLogger("gallings.api")

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
                same = origin.lower().split("://", 1)[-1].rstrip("/") == h.get("host", "").lower()
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


class NoCacheStaticFiles(StaticFiles):
    """防止桌面 WebView2 持久缓存旧版前端 JS/CSS。"""

    async def get_response(self, path: str, scope: dict) -> Any:
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "no-cache"
        return resp
