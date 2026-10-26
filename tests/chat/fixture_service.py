"""Short-lived browser-test service. No private config, records, keys or external models."""
from __future__ import annotations

import argparse
import asyncio
import json
import socket
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn

from server.api import aftergame
from server.plugins import Error, TextDelta
from test_service import config


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", required=True)
    args = parser.parse_args()
    stats = {"calls": 0, "active": 0, "cancelled": 0, "tools": False}
    original_manager = aftergame.PluginManager

    class TestManager(original_manager):
        async def start(self):
            result = await super().start()
            model = self.chain("llm")[0]
            original_stream = model.stream

            async def stream(request):
                stats["calls"] += 1
                stats["active"] += 1
                stats["tools"] = stats["tools"] or bool(request.tools)
                try:
                    mode = request.messages[-1].content
                    if mode == "hold":
                        yield TextDelta("等待片段")
                        await asyncio.sleep(5)
                    if mode == "quota":
                        yield Error("rate_limit", "PRIVATE PROVIDER ERROR")
                        return
                    if mode == "markup":
                        yield TextDelta('<img src="invalid" onerror="window.injected=true">')
                        return
                    async for event in original_stream(request):
                        yield event
                except asyncio.CancelledError:
                    stats["cancelled"] += 1
                    raise
                finally:
                    stats["active"] -= 1

            model.stream = stream
            return result

    aftergame.PluginManager = TestManager
    with tempfile.TemporaryDirectory(prefix="haifeng-agent-test-") as directory:
        cfg = config(directory)
        cfg["server"]["allowed_origins"] = [args.origin]
        app = aftergame.create_app(cfg)

        @app.get("/__test/state")
        async def state():
            return dict(stats)

        @app.post("/__test/shutdown")
        async def shutdown():
            server.should_exit = True
            return {"stopping": True}

        # The OS allocates the actual free port; no fixed port takeover or stale lock file.
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            sock.listen(128)
            port = sock.getsockname()[1]
            server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, access_log=False, log_level="warning"))
            print(json.dumps({"port": port}), flush=True)
            server.run(sockets=[sock])


if __name__ == "__main__":
    main()
