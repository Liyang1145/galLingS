"""网页设置接口（/api/settings、/api/settings/test）与灵枢路径校验。"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI

from server.runtime import Runtime


def lingshu_path_problem(path: str) -> str:
    """灵枢路径要指向 dsh-memory 检出目录（里面有 md_cg/mcp_server.py）。不对就返回给人看的原因。"""
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


async def get_settings_dict(r: Runtime) -> dict[str, Any]:
    rep = r.plugins.report()
    return {
        **r.settings.public(r.config, r.base_environ),
        "llm_ready": bool(r.llm_chain()),
        "memory_ready": r.plugins.get("memory") is not None,
        "memory_active": getattr(getattr(r.plugins.get("memory"), "ctx", None), "plugin_id", ""),
        "tools": rep.get("tools") or {},
        "failed": {k: v for k, v in r.plugins.failed().items()},
    }


async def save_settings_dict(r: Runtime, body: dict[str, Any]) -> dict[str, Any]:
    warn = ""
    mem = body.get("memory") if isinstance(body.get("memory"), dict) else None
    if mem and mem.get("use") == "lingshu":
        raw_dsh = str(mem.get("dsh_memory_path") or "").strip()
        if raw_dsh:
            warn = lingshu_path_problem(raw_dsh)
            if warn:
                body = {k: v for k, v in body.items() if k != "memory"}
    r.settings.save(body)
    await r.reload_plugins()
    return {**await get_settings_dict(r), "warn": warn}


def mount(app: FastAPI, rt: Callable[[], Runtime]) -> None:
    @app.get("/api/settings")
    async def get_settings() -> dict[str, Any]:
        return await get_settings_dict(rt())

    @app.post("/api/settings")
    async def post_settings(body: dict[str, Any]) -> dict[str, Any]:
        return await save_settings_dict(rt(), body)

    @app.post("/api/settings/test")
    async def test_llm() -> dict[str, Any]:
        """用当前设置真调一次模型：回一句话就算通。"""
        from server.director.llm import complete

        r = rt()
        if not r.llm_chain():
            return {"ok": False, "message": "没有可用的模型（没填密钥，或插件没启动）"}
        try:
            res = await complete(
                r.llm_chain(),
                [{"role": "user", "content": "只回复两个字：在呢"}],
                timeout=30,
                max_tokens=32,
            )
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": str(e)[:200]}
        return {
            "ok": bool(res.text.strip()),
            "message": res.text.strip()[:40] or "模型连上了，但只返回了空内容（可能是思考模式把字数用完了）",
        }
