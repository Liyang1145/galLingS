"""把模型的文本流拆成三种片段：思考 / 角色台词 / 表情标签。

模型按系统提示词把思考写在 ``<think>...</think>`` 里，表情写成 ``<emotion>笑</emotion>``。
标签可能被流切成好几片（``<thi`` + ``nk>``），所以这里是一个小状态机，纯函数、无 IO，方便单测。
"""
from __future__ import annotations

from typing import Iterator, Literal

Kind = Literal["think", "say", "emotion"]

_OPEN_THINK, _CLOSE_THINK = "<think>", "</think>"
_OPEN_EMO, _CLOSE_EMO = "<emotion>", "</emotion>"
_TAGS = (_OPEN_THINK, _CLOSE_THINK, _OPEN_EMO, _CLOSE_EMO)


class StreamSplitter:
    def __init__(self) -> None:
        self.mode: Literal["say", "think", "emotion"] = "say"
        self.buf = ""
        self.emo = ""

    def _could_be_tag_prefix(self, s: str) -> bool:
        return any(t.startswith(s) for t in _TAGS)

    def feed(self, text: str) -> Iterator[tuple[Kind, str]]:
        self.buf += text
        out = ""
        while self.buf:
            i = self.buf.find("<")
            if i < 0:
                out += self.buf
                self.buf = ""
                break
            if i > 0:
                out += self.buf[:i]
                self.buf = self.buf[i:]
            # buf 以 "<" 开头
            tag = next((t for t in _TAGS if self.buf.startswith(t)), None)
            if tag is None:
                if self._could_be_tag_prefix(self.buf):
                    break  # 等下一片
                out += "<"
                self.buf = self.buf[1:]
                continue
            yield from self._flush(out)
            out = ""
            self.buf = self.buf[len(tag):]
            if tag == _OPEN_THINK and self.mode == "say":
                self.mode = "think"
            elif tag == _CLOSE_THINK and self.mode == "think":
                self.mode = "say"
            elif tag == _OPEN_EMO and self.mode == "say":
                self.mode, self.emo = "emotion", ""
            elif tag == _CLOSE_EMO and self.mode == "emotion":
                self.mode = "say"
                if self.emo.strip():
                    yield ("emotion", self.emo.strip()[:40])
            # 其它组合（比如 think 里出现 <emotion>）直接吞掉标签
        yield from self._flush(out)

    def _flush(self, s: str) -> Iterator[tuple[Kind, str]]:
        if not s:
            return
        if self.mode == "emotion":
            self.emo += s
        else:
            yield (self.mode, s)  # type: ignore[misc]

    def finish(self) -> Iterator[tuple[Kind, str]]:
        rest, self.buf = self.buf, ""
        if rest:
            yield from self._flush(rest)
        self.mode = "say"
