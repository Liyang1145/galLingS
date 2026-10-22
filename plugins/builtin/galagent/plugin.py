"""gallings.tool.galagent —— 结局后聊天的 Agent 插件。

两重身份：
1. 普通 tool 插件：导出 powershell / read_file / write_file / list_dir / fetch_url / get_time，
   和其它 tool 插件一样由 PluginManager 管理、写 tool.called 事件。
2. post_ending 提供者：实现 ``open_post_ending()``，引擎的 ``/ws/post_ending`` 端口找到它后，
   每个聊天窗口开一个 :class:`GalAgentSession`。

扩展：
1. 其它 tool 插件在清单里写 ``capabilities: [galagent]``（含 ``runtime.type: mcp`` 的 MCPToolPlugin，
   如内置的 ``gallings.tool.lingshu-mcp``），它的工具就会出现在结局后聊天里。
2. 也可在 ``gallings.tool.galagent.mcp_servers`` 中动态配置外部 MCP stdio 服务。
详见 docs/design/galagent.md。
"""
from __future__ import annotations

import shutil
import sys
from typing import Any

from server.plugins import MCPError, ToolPlugin, ToolResult, ToolSpec
from server.plugins.mcp import MCPClient, mcp_content_to_value

from .loop import PROTOCOL, GalAgentSession, Send, ToolEntry
from .prompts import persona_from_card
from .tools_basic import BasicTools

__all__ = ["GalAgent", "GalAgentSession", "PROTOCOL"]


class ManagerRegistry:
    """把 PluginManager 里可用的工具包装成会话用的注册表（自带工具 + 声明了 galagent 能力的插件工具 + 动态 MCP 服务）。"""

    def __init__(self, owner: "GalAgent", manager: Any) -> None:
        self.owner = owner
        self.manager = manager

    def _plugin_ids(self) -> list[str]:
        cfg_extra = list(self.owner.ctx.config.get("extra_tool_plugins") or [])
        out: list[str] = []
        for pid in self.manager.settings.multi.get("tool", []):
            st = self.manager.states.get(pid)
            if st is None or st.status != "running":
                continue
            if pid == self.owner.ctx.plugin_id or "galagent" in st.manifest.capabilities \
                    or "*" in cfg_extra or pid in cfg_extra:
                out.append(pid)
        return out

    async def entries(self) -> list[ToolEntry]:
        out: list[ToolEntry] = []
        seen: set[str] = set()
        for pid in self._plugin_ids():
            inst = self.manager.states[pid].instance
            for spec in await inst.list_tools():
                if spec.name not in seen:
                    seen.add(spec.name)
                    out.append(ToolEntry(spec, pid, self.owner.policy(spec)))
        for entry in self.owner.mcp_entries():
            if entry.spec.name not in seen:
                seen.add(entry.spec.name)
                out.append(entry)
        return out

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        if self.owner.has_mcp_tool(name):
            return await self.owner.call_mcp(name, arguments)
        return await self.manager.call_tool(name, arguments, turn)


class LocalRegistry:
    """没有 PluginManager 时（单测、独立运行）用自带工具 + 动态 MCP 服务。"""

    def __init__(self, owner: "GalAgent") -> None:
        self.owner = owner

    async def entries(self) -> list[ToolEntry]:
        base = [ToolEntry(s, self.owner.ctx.plugin_id, self.owner.policy(s)) for s in await self.owner.list_tools()]
        seen = {e.spec.name for e in base}
        for e in self.owner.mcp_entries():
            if e.spec.name not in seen:
                seen.add(e.spec.name)
                base.append(e)
        return base

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        if self.owner.has_mcp_tool(name):
            return await self.owner.call_mcp(name, arguments)
        return await self.owner.call(name, arguments, turn)


class GalAgent(ToolPlugin):
    async def setup(self) -> None:
        self.tools = BasicTools(self.ctx.config, self.ctx.data_dir)
        self._mcp_clients: dict[str, MCPClient] = {}
        self._mcp_tools: dict[str, tuple[str, ToolSpec, str]] = {}
        await self._setup_mcp_servers()
        self.ctx.log.info(
            "GalAgent 工作目录：%s；shell：%s；动态 MCP 服务：%d 个",
            self.tools.workspace,
            self.tools.shell[0] if self.tools.shell else "无",
            len(self._mcp_clients),
        )

    async def _setup_mcp_servers(self) -> None:
        for srv in self.ctx.config.get("mcp_servers") or []:
            if not isinstance(srv, dict) or not srv.get("name") or not srv.get("command"):
                continue
            sname = str(srv["name"])
            raw_cmd = [str(c) for c in srv["command"]]
            cmd: list[str] = []
            for i, c in enumerate(raw_cmd):
                c = c.replace("${data_dir}", str(self.ctx.data_dir)).replace("${plugin_dir}", str(self.ctx.plugin_dir)).replace("${python}", sys.executable)
                if i == 0 and c in ("python3", "python") and not shutil.which(c):
                    c = sys.executable
                cmd.append(c)
            env = {
                str(k): str(v).replace("${data_dir}", str(self.ctx.data_dir)).replace("${plugin_dir}", str(self.ctx.plugin_dir))
                for k, v in (srv.get("env") or {}).items()
            }
            cwd = str(srv.get("cwd") or "").replace("${data_dir}", str(self.ctx.data_dir)).replace("${plugin_dir}", str(self.ctx.plugin_dir)) or str(self.tools.workspace)
            client = MCPClient(cmd, env=env, cwd=cwd, name=f"mcp:{sname}")
            try:
                await client.start()
                allowed = set(srv.get("tools") or [])
                default_pol = str(srv.get("confirm") or "ask")
                for t in await client.list_tools():
                    tname = str(t.get("name") or "")
                    if not tname or (allowed and tname not in allowed):
                        continue
                    spec = ToolSpec(
                        tname,
                        str(t.get("description") or ""),
                        t.get("inputSchema") or {"type": "object", "properties": {}},
                        effect="read",
                    )
                    by_name = self.ctx.config.get("confirm") or {}
                    pol = by_name.get(tname, default_pol)
                    self._mcp_tools[tname] = (sname, spec, pol)
                self._mcp_clients[sname] = client
            except Exception as e:  # noqa: BLE001
                self.ctx.log.warning("动态 MCP 服务 %s 启动失败：%s", sname, e)
                await client.close()

    def mcp_entries(self) -> list[ToolEntry]:
        return [
            ToolEntry(spec, f"mcp:{sname}", pol)
            for sname, spec, pol in self._mcp_tools.values()
        ]

    def has_mcp_tool(self, name: str) -> bool:
        return name in self._mcp_tools

    async def call_mcp(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        item = self._mcp_tools.get(name)
        if not item:
            return ToolResult(False, error=f"未知 MCP 工具 {name}")
        sname, _spec, _pol = item
        client = self._mcp_clients.get(sname)
        if not client:
            return ToolResult(False, error=f"MCP 服务 {sname} 未运行")
        try:
            res = await client.call_tool(name, arguments)
        except MCPError as e:
            return ToolResult(False, error=str(e))
        return ToolResult(not res.get("isError", False), content=mcp_content_to_value(res))

    async def health(self) -> dict[str, Any]:
        return {
            "ok": True,
            "workspace": str(self.tools.workspace),
            "shell": self.tools.shell[0] if self.tools.shell else None,
            "mcp_servers": {k: c.alive for k, c in self._mcp_clients.items()},
        }

    async def close(self) -> None:
        for c in list(getattr(self, "_mcp_clients", {}).values()):
            await c.close()
        getattr(self, "_mcp_clients", {}).clear()
        getattr(self, "_mcp_tools", {}).clear()

    # ------------------------------------------------------------------ tool 接口
    async def list_tools(self) -> list[ToolSpec]:
        return self.tools.specs()

    async def call(self, name: str, arguments: dict[str, Any], turn: dict[str, Any]) -> ToolResult:
        spec = next((s for s in self.tools.specs() if s.name == name), None)
        if spec is None:
            return ToolResult(False, error=f"未知工具 {name}")
        try:
            import jsonschema
            jsonschema.validate(arguments, spec.parameters)
        except Exception as e:  # noqa: BLE001
            return ToolResult(False, error=f"参数不合法：{getattr(e, 'message', e)}")
        return await self.tools.call(name, arguments)

    # ------------------------------------------------------------------ 确认策略
    def policy(self, spec: ToolSpec) -> str:
        c = self.ctx.config
        by_name = c.get("confirm") or {}
        if spec.name in by_name:
            return by_name[spec.name]
        return (c.get("confirm_by_effect") or {}).get(spec.effect, "ask")

    # ------------------------------------------------------------------ post_ending 提供者
    def open_post_ending(self, *, llm_chain: list[Any], send: Send, manager: Any | None = None) -> GalAgentSession:
        reg = ManagerRegistry(self, manager) if manager is not None else LocalRegistry(self)
        return GalAgentSession(llm_chain=llm_chain, registry=reg, send=send, config=self.ctx.config,
                               workspace=str(self.tools.workspace), log=self.ctx.log, emit=self.ctx.emit)

    @staticmethod
    def character_from_card(card: dict[str, Any]) -> dict[str, Any]:
        return {"name": (card.get("identity") or {}).get("name", card.get("id", "她")),
                "persona": persona_from_card(card),
                "expressions": list((card.get("assets") or {}).get("sprites") or [])}
