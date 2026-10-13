"""GalAgent 自带的基础工具：powershell、文件读写、列目录、抓网页、取时间。

安全边界（重要）：
- 文件工具只在工作目录内活动（``allow_outside_workspace`` 可放开）。
- powershell 能做任何事，路径限制挡不住它，所以默认确认策略是 ``ask``：每次执行前由玩家点“允许”。
- 输出一律截断到 ``max_output_chars``，避免把模型上下文撑爆。
"""
from __future__ import annotations

import asyncio
import datetime as _dt
import html
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

from server.plugins import ToolResult, ToolSpec

IS_WIN = sys.platform.startswith("win")


def detect_shell(pref: str = "auto") -> tuple[str, list[str]] | None:
    """返回 (显示名, 命令前缀)。命令本体作为最后一个参数追加。"""
    cands: list[str]
    if pref == "auto":
        cands = ["pwsh", "powershell"] + ([] if IS_WIN else ["bash", "sh"])
    else:
        cands = [pref]
    for c in cands:
        exe = shutil.which(c if not (IS_WIN and c == "powershell") else "powershell.exe") or shutil.which(c)
        if not exe:
            continue
        if c in ("pwsh", "powershell"):
            return c, [exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
        return c, [exe, "-c"] if c == "sh" else [exe, "-lc"]
    return None


def _truncate(s: str, n: int) -> tuple[str, bool]:
    if len(s) <= n:
        return s, False
    head = s[: n * 2 // 3]
    tail = s[-(n // 3):]
    return f"{head}\n…（中间省略 {len(s) - len(head) - len(tail)} 字）…\n{tail}", True


def _decode(b: bytes) -> str:
    for enc in ("utf-8", "gbk") if IS_WIN else ("utf-8",):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            continue
    return b.decode("utf-8", "replace")


class BasicTools:
    def __init__(self, config: dict[str, Any], data_dir: Path) -> None:
        self.cfg = config
        ws = (config.get("workspace") or "").strip()
        self.workspace = Path(os.path.expanduser(ws)).resolve() if ws else (data_dir / "workspace").resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.shell = detect_shell(config.get("shell", "auto"))
        self.max_out = int(config.get("max_output_chars", 8000))

    # ------------------------------------------------------------------ 规格
    def specs(self) -> list[ToolSpec]:
        shell_name = self.shell[0] if self.shell else "（未找到可用 shell）"
        ps_note = "" if (self.shell and self.shell[0] in ("pwsh", "powershell")) else \
            f"注意：本机没有 PowerShell，命令实际由 {shell_name} 执行，请写对应语法。"
        return [
            ToolSpec("powershell",
                     f"在玩家电脑上执行一条 PowerShell 命令并返回输出（当前 shell：{shell_name}，工作目录：{self.workspace}）。"
                     f"用于查看文件、系统信息、批量处理等。执行前可能需要玩家确认。{ps_note}",
                     {"type": "object", "additionalProperties": False, "required": ["command"],
                      "properties": {"command": {"type": "string", "description": "要执行的命令"},
                                     "timeout_s": {"type": "number", "minimum": 1, "maximum": 600,
                                                   "description": "超时秒数，默认取配置"}}},
                     effect="perform"),
            ToolSpec("read_file", "读取工作目录里的文本文件（UTF-8）。路径相对工作目录。",
                     {"type": "object", "additionalProperties": False, "required": ["path"],
                      "properties": {"path": {"type": "string"},
                                     "max_chars": {"type": "integer", "minimum": 100, "maximum": 200000}}},
                     effect="read"),
            ToolSpec("write_file", "把文本写入工作目录里的文件（不存在就创建，含上级目录）。",
                     {"type": "object", "additionalProperties": False, "required": ["path", "content"],
                      "properties": {"path": {"type": "string"}, "content": {"type": "string"},
                                     "append": {"type": "boolean", "default": False}}},
                     effect="perform"),
            ToolSpec("list_dir", "列出工作目录（或其子目录）下的文件和文件夹。",
                     {"type": "object", "additionalProperties": False,
                      "properties": {"path": {"type": "string", "default": "."},
                                     "depth": {"type": "integer", "minimum": 1, "maximum": 4, "default": 1}}},
                     effect="read"),
            ToolSpec("fetch_url", "抓取一个网页（http/https），返回去掉标签后的正文文本。",
                     {"type": "object", "additionalProperties": False, "required": ["url"],
                      "properties": {"url": {"type": "string"},
                                     "max_chars": {"type": "integer", "minimum": 200, "maximum": 100000}}},
                     effect="read"),
            ToolSpec("get_time", "获取玩家电脑上的当前日期、时间和星期。",
                     {"type": "object", "additionalProperties": False, "properties": {}}, effect="read"),
        ]

    # ------------------------------------------------------------------ 路径
    def resolve(self, p: str) -> Path:
        raw = Path(os.path.expanduser(str(p or ".")))
        full = (raw if raw.is_absolute() else self.workspace / raw).resolve()
        if not self.cfg.get("allow_outside_workspace"):
            try:
                full.relative_to(self.workspace)
            except ValueError:
                raise PermissionError(f"路径在工作目录之外：{p}（工作目录：{self.workspace}）") from None
        return full

    # ------------------------------------------------------------------ 调用
    async def call(self, name: str, a: dict[str, Any]) -> ToolResult:
        try:
            fn = getattr(self, f"_t_{name}")
        except AttributeError:
            return ToolResult(False, error=f"未知工具 {name}")
        try:
            return await fn(a)
        except PermissionError as e:
            return ToolResult(False, error=str(e))
        except FileNotFoundError as e:
            return ToolResult(False, error=f"找不到：{e.filename or e}")
        except Exception as e:  # noqa: BLE001 - 工具错误回给模型，不炸会话
            return ToolResult(False, error=f"{type(e).__name__}: {e}")

    async def _t_powershell(self, a: dict[str, Any]) -> ToolResult:
        if not self.shell:
            return ToolResult(False, error="本机没有找到 pwsh / powershell / bash / sh")
        name, prefix = self.shell
        cmd = str(a["command"])
        if name in ("pwsh", "powershell"):
            cmd = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;" + cmd
        timeout = float(a.get("timeout_s") or self.cfg.get("shell_timeout_s", 60))
        t0 = time.perf_counter()
        kw: dict[str, Any] = {}
        if IS_WIN:
            kw["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
        proc = await asyncio.create_subprocess_exec(*prefix, cmd, cwd=str(self.workspace),
                                                    stdin=asyncio.subprocess.DEVNULL,
                                                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, **kw)
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return ToolResult(False, error=f"命令超时（{timeout:g} 秒）已终止", content={"shell": name})
        except asyncio.CancelledError:
            proc.kill()
            raise
        so, t1 = _truncate(_decode(out), self.max_out)
        se, t2 = _truncate(_decode(err), self.max_out // 2)
        content = {"shell": name, "exit_code": proc.returncode, "stdout": so, "stderr": se,
                   "truncated": t1 or t2, "elapsed_ms": round((time.perf_counter() - t0) * 1000)}
        return ToolResult(proc.returncode == 0, content=content,
                          error=None if proc.returncode == 0 else f"退出码 {proc.returncode}")

    async def _t_read_file(self, a: dict[str, Any]) -> ToolResult:
        p = self.resolve(a["path"])
        if p.is_dir():
            return ToolResult(False, error=f"{a['path']} 是文件夹，请用 list_dir")
        n = int(a.get("max_chars") or self.max_out)
        text = p.read_text(encoding="utf-8", errors="replace")
        body, cut = _truncate(text, n)
        return ToolResult(True, content={"path": str(p), "chars": len(text), "truncated": cut, "text": body})

    async def _t_write_file(self, a: dict[str, Any]) -> ToolResult:
        p = self.resolve(a["path"])
        p.parent.mkdir(parents=True, exist_ok=True)
        mode = "a" if a.get("append") else "w"
        with p.open(mode, encoding="utf-8", newline="") as f:
            f.write(str(a["content"]))
        return ToolResult(True, content={"path": str(p), "bytes": p.stat().st_size, "mode": mode})

    async def _t_list_dir(self, a: dict[str, Any]) -> ToolResult:
        root = self.resolve(a.get("path") or ".")
        depth = int(a.get("depth") or 1)
        items: list[str] = []

        def walk(d: Path, lvl: int) -> None:
            for c in sorted(d.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if len(items) >= 500:
                    return
                rel = c.relative_to(root).as_posix()
                if c.is_dir():
                    items.append(rel + "/")
                    if lvl < depth:
                        walk(c, lvl + 1)
                else:
                    items.append(f"{rel}  ({c.stat().st_size} B)")

        walk(root, 1)
        return ToolResult(True, content={"path": str(root), "entries": items, "count": len(items)})

    async def _t_fetch_url(self, a: dict[str, Any]) -> ToolResult:
        import httpx

        url = str(a["url"]).strip()
        if not re.match(r"^https?://", url, re.I):
            return ToolResult(False, error="只支持 http/https 网址")
        cap = int(self.cfg.get("fetch_max_bytes", 400000))
        async with httpx.AsyncClient(follow_redirects=True, timeout=20,
                                     headers={"User-Agent": "galLingS-GalAgent/0.1"}) as c:
            async with c.stream("GET", url) as r:
                buf = b""
                async for chunk in r.aiter_bytes():
                    buf += chunk
                    if len(buf) > cap:
                        break
                ctype = r.headers.get("content-type", "")
                status = r.status_code
        text = buf.decode(r.encoding or "utf-8", "replace")
        if "html" in ctype or text.lstrip().startswith("<"):
            title = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
            text = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", text)
            text = re.sub(r"(?s)<[^>]+>", " ", text)
            text = html.unescape(re.sub(r"[ \t\r\f\v]+", " ", text))
            text = re.sub(r"\n\s*\n+", "\n", text).strip()
            if title:
                text = f"标题：{html.unescape(title.group(1).strip())}\n{text}"
        body, cut = _truncate(text, int(a.get("max_chars") or self.max_out))
        return ToolResult(200 <= status < 400, content={"url": url, "status": status, "truncated": cut, "text": body},
                          error=None if 200 <= status < 400 else f"HTTP {status}")

    async def _t_get_time(self, a: dict[str, Any]) -> ToolResult:
        now = _dt.datetime.now().astimezone()
        wd = "一二三四五六日"[now.weekday()]
        return ToolResult(True, content={"iso": now.isoformat(timespec="seconds"), "weekday": f"星期{wd}",
                                         "tz": str(now.tzinfo)})
