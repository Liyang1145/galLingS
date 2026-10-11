"""测试用最小 MCP stdio 服务。FAKE_MCP_CRASH_ON=<工具名> 时第一次调用该工具会直接退出进程（测自动重启）。"""
import json
import os
import sys

TOOLS = [
    {"name": "echo", "description": "原样返回", "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}}},
    {"name": "add", "description": "加法", "inputSchema": {"type": "object", "properties": {"a": {"type": "number"}, "b": {"type": "number"}}}},
    {"name": "secret_tool", "description": "不应被导出", "inputSchema": {"type": "object"}},
]
crash_on = os.environ.get("FAKE_MCP_CRASH_ON")
marker = os.environ.get("FAKE_MCP_MARKER")


def reply(rid, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": rid}
    msg["error" if error else "result"] = error or result
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


print("this is a log line on stdout that clients must ignore", flush=True)
for line in sys.stdin:
    req = json.loads(line)
    m, rid = req.get("method"), req.get("id")
    if m == "initialize":
        reply(rid, {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                    "serverInfo": {"name": "fake", "version": "0"}})
    elif m == "tools/list":
        reply(rid, {"tools": TOOLS})
    elif m == "tools/call":
        name, args = req["params"]["name"], req["params"].get("arguments") or {}
        if name == crash_on and marker and not os.path.exists(marker):
            open(marker, "w").close()
            sys.exit(1)
        if name == "echo":
            reply(rid, {"content": [{"type": "text", "text": args.get("text", "")}]})
        elif name == "add":
            reply(rid, {"content": [{"type": "text", "text": json.dumps({"sum": args["a"] + args["b"]})}]})
        else:
            reply(rid, {"content": [{"type": "text", "text": "nope"}], "isError": True})
    elif m == "shutdown":
        break
    elif rid is not None:
        reply(rid, error={"code": -32601, "message": f"unknown method {m}"})
