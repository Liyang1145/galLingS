"""OpenAI 风格 SSE 流解析器（转发至 server.plugins.sse 共用实现）。"""
from __future__ import annotations

from server.plugins.sse import StreamNormalizer, http_status_error, normalize

__all__ = ["StreamNormalizer", "http_status_error", "normalize"]
