"""剧本编译器：Markdown 剧本 + 节拍层元数据 → Chapter JSON（扁平 OP 程序）+ 校验报告（PLAN §6.4）。"""
from .compile import compile_chapter, CompileError  # noqa: F401
