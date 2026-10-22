"""桌面 / Steam 宿主桥兼容接口（/__host/*）。"""
from __future__ import annotations

import contextlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI

from server.api.settings import get_settings_dict, save_settings_dict
from server.runtime import Runtime

SAVE_KINDS = ("slots", "global", "prefs", "read", "plugins")


def _host_save_dir(r: Runtime) -> Path:
    env_dir = os.environ.get("GALLINGS_SAVE_DIR")
    d = Path(env_dir) if env_dir else (r.data_dir / "saves")
    d.mkdir(parents=True, exist_ok=True)
    return d


def mount(app: FastAPI, rt: Callable[[], Runtime]) -> None:
    @app.get("/__host/info")
    async def host_info() -> dict[str, Any]:
        r = rt()
        sdir = _host_save_dir(r)
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
        sdir = _host_save_dir(rt())
        data: dict[str, Any] = {}
        for k in SAVE_KINDS:
            f = sdir / f"{k}.json"
            if f.is_file():
                with contextlib.suppress(OSError, ValueError):
                    data[k] = json.loads(f.read_text(encoding="utf-8"))
        return {"ok": True, "save_dir": str(sdir), "data": data}

    @app.post("/__host/saves")
    async def host_post_saves(body: dict[str, Any]) -> dict[str, Any]:
        sdir = _host_save_dir(rt())
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
        s = await get_settings_dict(rt())
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
        await save_settings_dict(rt(), patch)
        return await host_get_llm()

    @app.post("/__host/window")
    async def host_window(body: dict[str, Any]) -> dict[str, Any]:
        action = str(body.get("action") or "")
        sdir = _host_save_dir(rt())
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
