"""最小 MCP stdio 客户端（换行分隔 JSON-RPC 2.0），以及把 MCP 服务包成 tool 插件的通用适配器。

只实现引擎需要的子集：initialize / notifications/initialized / tools/list / tools/call / shutdown。
子进程崩溃时自动重启一次（PLAN §3.2）；再崩则抛 MCPError，交给降级阶梯。
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from .errors import MCPError
from .kinds import ToolPlugin, ToolResult, ToolSpec

PROTOCOL_VERSION = "2024-11-05"
CLIENT_INFO = {"name": "galLingS", "version": "0.1.0"}


class MCPClient:
    def __init__(self, command: list[str], env: dict[str, str] | None = None, cwd: str | None = None,
                 startup_timeout_s: float = 20.0, call_timeout_s: float = 30.0, name: str = "mcp",
                 max_restarts: int = 1) -> None:
        self.command, self.env, self.cwd = list(command), dict(env or {}), cwd
        self.startup_timeout_s, self.call_timeout_s = startup_timeout_s, call_timeout_s
        self.name, self.max_restarts = name, max_restarts
        self.restarts = 0
        self.server_info: dict[str, Any] = {}
        self._proc: asyncio.subprocess.Process | None = None
        self._next_id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self.stderr_tail: list[str] = []
        self._bg: list[asyncio.Task] = []

    @property
    def alive(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    async def start(self) -> None:
        env = {**os.environ, **self.env}
        try:
            self._proc = await asyncio.create_subprocess_exec(
                *self.command, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE, env=env, cwd=self.cwd, limit=16 * 1024 * 1024)
        except OSError as e:
            raise MCPError(f"无法启动 {self.command[0]}：{e}", self.name) from None
        self._reader = asyncio.create_task(self._read_loop())
        self._bg.append(asyncio.create_task(self._drain_stderr(self._proc)))
        try:
            res = await self._request("initialize", {
                "protocolVersion": PROTOCOL_VERSION, "capabilities": {}, "clientInfo": CLIENT_INFO,
            }, timeout=self.startup_timeout_s)
        except MCPError:
            await self.close()
            raise
        self.server_info = res if isinstance(res, dict) else {}
        await self._notify("notifications/initialized", {})

    async def _drain_stderr(self, proc: asyncio.subprocess.Process) -> None:
        assert proc.stderr is not None
        while True:
            line = await proc.stderr.readline()
            if not line:
                return
            self.stderr_tail = (self.stderr_tail + [line.decode("utf-8", "replace").rstrip()])[-20:]

    async def _read_loop(self) -> None:
        assert self._proc and self._proc.stdout
        try:
            while True:
                line = await self._proc.stdout.readline()
                if not line:
                    break
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue  # 服务端把日志打到了 stdout：忽略非 JSON 行
                rid = msg.get("id") if isinstance(msg, dict) else None
                fut = self._pending.pop(rid, None) if isinstance(rid, int) else None
                if fut and not fut.done():
                    if "error" in msg:
                        err = msg["error"] or {}
                        fut.set_exception(MCPError(f"{err.get('code')}: {err.get('message')}", self.name))
                    else:
                        fut.set_result(msg.get("result"))
        finally:
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(MCPError("子进程已退出：" + " | ".join(self.stderr_tail[-3:]), self.name))
            self._pending.clear()

    async def _send(self, msg: dict[str, Any]) -> None:
        if not self.alive:
            raise MCPError("子进程未运行", self.name)
        assert self._proc and self._proc.stdin
        self._proc.stdin.write((json.dumps(msg, ensure_ascii=False) + "\n").encode("utf-8"))
        await self._proc.stdin.drain()

    async def _notify(self, method: str, params: dict[str, Any]) -> None:
        await self._send({"jsonrpc": "2.0", "method": method, "params": params})

    async def _request(self, method: str, params: dict[str, Any], timeout: float | None = None) -> Any:
        self._next_id += 1
        rid = self._next_id
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[rid] = fut
        try:
            await self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        except (BrokenPipeError, ConnectionResetError) as e:
            self._pending.pop(rid, None)
            raise MCPError(f"写入失败：{e}", self.name) from None
        try:
            return await asyncio.wait_for(fut, timeout or self.call_timeout_s)
        except asyncio.TimeoutError:
            self._pending.pop(rid, None)
            raise MCPError(f"{method} 超时（{timeout or self.call_timeout_s}s）", self.name) from None

    async def request(self, method: str, params: dict[str, Any]) -> Any:
        """带一次自动重启的请求。"""
        async with self._lock:
            if not self.alive:
                await self._restart()
            try:
                return await self._request(method, params)
            except MCPError:
                if self.alive:
                    raise
                await self._restart()
                return await self._request(method, params)

    async def _restart(self) -> None:
        if self.restarts >= self.max_restarts:
            raise MCPError(f"子进程已崩溃，重启次数用尽（{self.restarts}）", self.name)
        self.restarts += 1
        await self.close()
        await self.start()

    async def list_tools(self) -> list[dict[str, Any]]:
        res = await self.request("tools/list", {})
        return list((res or {}).get("tools") or [])

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return await self.request("tools/call", {"name": name, "arguments": arguments}) or {}

    async def close(self) -> None:
        proc, self._proc = self._proc, None
        if proc is None:
            return
        try:
            if proc.returncode is None and proc.stdin and not proc.stdin.is_closing():
                proc.stdin.write(b'{"jsonrpc":"2.0","method":"shutdown","params":{}}\n')
                await proc.stdin.drain()
        except (BrokenPipeError, ConnectionResetError):
            pass
        if proc.stdin and not proc.stdin.is_closing():
            proc.stdin.close()
        try:
            await asyncio.wait_for(proc.wait(), 3)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
        if self._reader:
            self._reader.cancel()
            try:
                await self._reader
            except (asyncio.CancelledError, Exception):
                pass
            self._reader = None
        for t in self._bg:
            t.cancel()
        self._bg.clear()


def mcp_content_to_value(result: dict[str, Any]) -> Any:
    """MCP tools/call 的 content 列表 → Python 值：单个 text 块且是 JSON 时解析成对象。"""
    blocks = result.get("content") or []
    texts = [b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text"]
    if len(texts) == 1:
        try:
            return json.loads(texts[0])
        except (json.JSONDecodeError, TypeError):
            return texts[0]
    return texts if texts else blocks


class MCPToolPlugin(ToolPlugin):
    """runtime.type=mcp 的 tool 插件：把 MCP 服务的工具按清单 provides.tools 白名单导出。"""

    def __init__(self, ctx, runtime: dict[str, Any], allowed: tuple[str, ...]) -> None:
        super().__init__(ctx)
        env = {k: v.replace("${data_dir}", str(ctx.data_dir)).replace("${plugin_dir}", str(ctx.plugin_dir))
               for k, v in (runtime.get("env") or {}).items()}
        cmd = [c.replace("${plugin_dir}", str(ctx.plugin_dir)) for c in runtime["command"]]
        self.client = MCPClient(cmd, env=env, cwd=runtime.get("cwd") or str(ctx.plugin_dir),
                                startup_timeout_s=runtime.get("startup_timeout_s", 20),
                                call_timeout_s=runtime.get("call_timeout_s", 30), name=ctx.plugin_id)
        self.allowed = allowed
        self._specs: list[ToolSpec] = []

    async def setup(self) -> None:
        await self.client.start()
        remote = {t["name"]: t for t in await self.client.list_tools()}
        missing = [n for n in self.allowed if n not in remote]
        if missing:
            raise MCPError(f"MCP 服务没有清单声明的工具：{missing}", self.ctx.plugin_id)
        self._specs = [ToolSpec(n, remote[n].get("description", ""),
                                remote[n].get("inputSchema") or {"type": "object"}) for n in self.allowed]

    async def list_tools(self) -> list[ToolSpec]:
        return list(self._specs)

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        if name not in self.allowed:
            return ToolResult(False, error=f"工具 {name} 不在白名单")
        try:
            res = await self.client.call_tool(name, arguments)
        except MCPError as e:
            return ToolResult(False, error=str(e))
        return ToolResult(not res.get("isError", False), content=mcp_content_to_value(res))

    async def health(self) -> dict[str, Any]:
        return {"ok": self.client.alive, "restarts": self.client.restarts}

    async def close(self) -> None:
        await self.client.close()
