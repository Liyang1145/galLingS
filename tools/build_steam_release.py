"""一键构建《海风与布丁》Steam 发行包（双模架构：Python 灵枢完整引擎 + galcore.wasm 离线兜底 + 多模型插件 + 灵枢认知图 MCP + GalAgent 完整工具链）。

用法：
    python tools/build_steam_release.py                  # Release 构建 → dist/steam/
    python tools/build_steam_release.py --appid 480      # 指定 Steam AppID（默认 480 用于本地测试）
    python tools/build_steam_release.py --debug          # Debug 快速构建（开发联调）
    python tools/build_steam_release.py --skip-rust      # 仅更新前端、后端插件与剧本资源（复用已有 exe 与 wasm）

产物结构（dist/steam/）：
    content/                        ← SteamPipe Depot ContentRoot（直接上传此目录）
      HaifengPudding.exe            ← 游戏主程序（Steam 启动项填写 HaifengPudding.exe）
      steam_appid.txt               ← Steam AppID
      game/                         ← 完整游戏资源（剧本、立绘、音乐、配音、galcore.wasm、GalAgent）
      server/                       ← galLingS 完整服务端（/ws、/ws/soul、/ws/post_ending、/api/settings）
      plugins/                      ← 内置插件集（灵枢认知图 MCP、多模型 LLM 插件、GalAgent 完整工具链与 MCP 扩展）
      compiler/                     ← VN Studio 剧本 OP 编译器
      content/cards/                ← 角色卡定义（whale.yaml 等）
      schemas/                      ← JSON Schema 校验定义
      web/                          ← 外框与宿主桥前端资源
      config.example.yaml           ← 默认插件链配置
    steampipe/
      app_build.vdf                 ← SteamPipe 构建脚本模板
      depot_build.vdf               ← SteamPipe Depot 映射脚本模板
    STEAMWORKS_GUIDE.md             ← Steamworks 后台配置（启动项、Steam Auto-Cloud 云存档路径）说明
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.build_desktop_dist import main as build_desktop_dist  # noqa: E402


def write_steampipe_configs(steam_dir: Path, app_id: str, depot_id: str) -> None:
    sp_dir = steam_dir / "steampipe"
    sp_dir.mkdir(parents=True, exist_ok=True)
    (sp_dir / "output").mkdir(parents=True, exist_ok=True)

    app_vdf = f'''"AppBuild"
{{
\t"AppID" "{app_id}"
\t"Desc" "Haifeng and Pudding (海风与布丁) Steam Release"
\t"ContentRoot" "..\\\\content\\\\"
\t"BuildOutput" ".\\\\output\\\\"
\t"Depots"
\t{{
\t\t"{depot_id}" "depot_build.vdf"
\t}}
}}
'''
    depot_vdf = f'''"DepotBuild"
{{
\t"DepotID" "{depot_id}"
\t"FileMapping"
\t{{
\t\t"LocalPath" "*"
\t\t"DepotPath" "."
\t\t"Recursive" "1"
\t}}
\t"FileExclusion" "*.pdb"
\t"FileExclusion" "__pycache__/*"
\t"FileExclusion" "userdata/*"
}}
'''
    (sp_dir / "app_build.vdf").write_text(app_vdf, encoding="utf-8")
    (sp_dir / "depot_build.vdf").write_text(depot_vdf, encoding="utf-8")

    guide = f"""# 《海风与布丁》Steam 发行与 Steamworks 配置指南

## 1. 目录结构与双模架构
- `content/`：Steam Depot 根目录（直接双击 `content/HaifengPudding.exe` 即可游玩）
  - `HaifengPudding.exe`：Windows 64 位原生客户端，内置 **「完整引擎 + 离线 WASM 兜底」双模架构**：
    1. **完整引擎模式（默认优先）**：启动时自动探测并后台静默拉起 `galLingS` Python 服务端（`127.0.0.1`），完整挂载：
       - **灵枢认知图 MCP 记忆库**（`gallings.memory.lingshu`，内置 `md_cg.mcp_server` 认知图扩散激活与时间线隔离，无需外部下载）
       - **多模型 LLM 插件链**（`gallings.llm.openai-compat` / `gallings.llm.anthropic` / `gallings.llm.gemini` / `gallings.llm.ollama`）
       - **GalAgent 完整工具链与 MCP 扩展**（`gallings.tool.galagent` + `gallings.tool.lingshu-mcp`，含 `powershell`、`read_file`、`write_file`、`list_dir`、`fetch_url`、`get_time` 及 `mdcg_*` MCP 认知图工具）
    2. **离线 WASM 兜底模式**：若目标机器无 Python 环境，自动无缝回退至内置 `app.localhost` + `galcore.wasm` 引擎，100% 保证剧演出、CG/音乐/配音、存档与直连大模型对话可用。
  - `game/`：游戏资源包（含《海风与布丁》全量立绘/CG/BGM/语音、`galcore.wasm` Rust 规则引擎、`GalAgent` 结局后聊天插件）
  - `server/`、`plugins/`、`compiler/`、`content/cards/`、`schemas/`、`web/`：完整灵枢后端与插件目录
  - `steam_appid.txt`：当前设置为 `{app_id}`（正式上传前可改为您的正式 AppID，或由 Steam 客户端自动注入）
- `steampipe/`：SteamPipe 上传脚本（`app_build.vdf` / `depot_build.vdf`）

## 2. Steamworks 后台配置

### 2.1 启动项配置（Installation → General Installation）
- **可执行文件（Executable）**：`HaifengPudding.exe`
- **操作系统**：Windows（64 位）

### 2.2 Steam Auto-Cloud 云存档配置（Application → Steam Cloud）
游戏已将所有存档、CG/结局解锁、阅读进度与偏好设置实时原子写入到系统的 AppData 目录，并将用户的私人大模型 API Key 物理隔离在 `config/llm.json`（不进云存档）：
- **根路径（Root）**：`WinAppDataRoaming`
- **子目录（Subdirectory）**：`com.gallings.haifeng/saves`
- **文件掩码（Pattern）**：`*.json`
  - `slots.json`：6 个手动存档位 + 快速存档 + 自动存档（含 `galcore` 引擎快照）
  - `global.json`：已解锁 CG、已达成结局、通关次数、全局变量
  - `prefs.json`：音量、文字速度、灵枢模式等偏好
  - `read.json`：已读台词记录（用于“仅快进已读”）
  - `plugins.json`：插件开关与模式设置
- **便携模式（Portable Mode）**：如果在 `HaifengPudding.exe` 同级目录新建 `portable.txt` 或 `userdata/` 文件夹，存档将改为保存在 `<游戏目录>/userdata/saves/`。

## 3. 游戏内功能与快捷键
- **纯净模式**：启动后直接进入《海风与布丁》标题画面，顶栏已隐藏。
- **结局后聊天（GalAgent）**：标题画面与结局卡均提供 **「和鲸鱼小姐聊聊」** 入口。
- **多模型与灵枢记忆配置**：打开游戏内 **「设置」→「灵枢记忆与多模型 AI 导演」**，可切换：
  - **剧情选项模式**：`纯选项（原著体验）` / `AI 模式（选项点可“自己说”）`
  - **记忆底座**：`灵枢认知图 (MCP)` / `本地轻量记忆`
  - **模型厂商协议**：`OpenAI / DeepSeek`、`Claude (Anthropic)`、`Gemini (Google)`、`Ollama 本地（免密钥）`
- **快捷键**：
  - `F11` 或 `Alt + Enter`：切换全屏 / 窗口
  - `F10` 或 `Ctrl + Shift + D`：展开 / 隐藏开发者调试顶栏与引擎时间轴

## 4. 使用 SteamPipe 上传
```powershell
steamcmd +login <您的Steamworks账号> +run_app_build "{(sp_dir / 'app_build.vdf').resolve()}" +quit
```
"""
    (steam_dir / "STEAMWORKS_GUIDE.md").write_text(guide, encoding="utf-8")


def _copy_clean_tree(src: Path, dst: Path) -> None:
    if not src.is_dir():
        return
    shutil.copytree(
        src,
        dst,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", ".pytest_cache"),
    )


def bundle_backend_runtime(content_dir: Path) -> None:
    """将 server/、plugins/、compiler/、schemas/、web/、content/cards/ 等完整灵枢后端打包进 Steam content 目录。"""
    for folder in ("server", "plugins", "compiler", "schemas", "web", "wheels"):
        _copy_clean_tree(ROOT / folder, content_dir / folder)
    _copy_clean_tree(ROOT / "content" / "cards", content_dir / "content" / "cards")
    cfg_example = ROOT / "config.example.yaml"
    if cfg_example.is_file():
        shutil.copy2(cfg_example, content_dir / "config.example.yaml")


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=str(ROOT / "dist" / "steam"), help="Steam 发行包输出目录（默认 dist/steam）")
    ap.add_argument("--appid", default="480", help="Steam AppID（默认 480）")
    ap.add_argument("--depotid", default="", help="Steam DepotID（默认 AppID + 1）")
    ap.add_argument("--debug", action="store_true", help="使用 cargo debug 模式构建客户端")
    ap.add_argument("--skip-rust", action="store_true", help="跳过 Rust 编译，直接复用已编译好的 wasm 和 exe")
    args = ap.parse_args(argv)

    app_id = str(args.appid).strip() or "480"
    depot_id = str(args.depotid).strip() or (str(int(app_id) + 1) if app_id.isdigit() else "481")

    # 1. 重新打包 GalAgent 插件并同步到作品目录
    ga_build = ROOT / "plugins" / "builtin" / "galagent" / "web" / "build_vnplugin.py"
    if ga_build.is_file():
        subprocess.run([sys.executable, str(ga_build)], check=True)
        game_dir = ROOT / "海风与布丁"
        if game_dir.is_dir():
            shutil.copy2(
                ga_build.parent / "galagent.vnplugin.js",
                game_dir / "galagent.vnplugin.js",
            )

    # 2. 编译 galcore.wasm
    wasm_path = ROOT / "core" / "target" / "wasm32-unknown-unknown" / "release" / "galcore.wasm"
    if not args.skip_rust or not wasm_path.is_file():
        print("==> [1/4] 编译 Rust 核心引擎 galcore.wasm ...")
        subprocess.run(
            ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
            cwd=ROOT / "core",
            check=True,
        )

    # 3. 构建 dist/desktop 离线资源包
    dist_desktop = ROOT / "dist" / "desktop"
    print("==> [2/4] 生成完整离线包 dist/desktop ...")
    rc = build_desktop_dist(["--out", str(dist_desktop), "--wasm", str(wasm_path)])
    if rc != 0:
        return rc

    # 4. 编译 Tauri 桌面外壳
    profile = "debug" if args.debug else "release"
    exe_src = ROOT / "desktop" / "src-tauri" / "target" / profile / "gallings-desktop.exe"
    if not args.skip_rust or not exe_src.is_file():
        print(f"==> [3/4] 编译 Tauri 桌面客户端 ({profile}) ...")
        cmd = ["cargo", "build"]
        if not args.debug:
            cmd.append("--release")
        subprocess.run(cmd, cwd=ROOT / "desktop" / "src-tauri", check=True)

    if not exe_src.is_file():
        print(f"找不到编译产物：{exe_src}", file=sys.stderr)
        return 1

    # 5. 组装 Steam Depot 目录
    steam_dir = Path(args.out)
    content_dir = steam_dir / "content"
    print(f"==> [4/4] 组装 Steam 发行目录：{steam_dir} ...")
    if content_dir.exists():
        shutil.rmtree(content_dir)
    content_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(exe_src, content_dir / "HaifengPudding.exe")
    (content_dir / "steam_appid.txt").write_text(f"{app_id}\n", encoding="utf-8")
    shutil.copytree(dist_desktop, content_dir / "game")
    bundle_backend_runtime(content_dir)
    write_steampipe_configs(steam_dir, app_id, depot_id)

    total_files = sum(1 for p in content_dir.rglob("*") if p.is_file())
    total_mb = sum(p.stat().st_size for p in content_dir.rglob("*") if p.is_file()) / 1e6
    print(
        f"Steam 发行包已就绪：{content_dir}（共 {total_files} 个文件，{total_mb:.1f} MB；"
        f"启动程序：HaifengPudding.exe；SteamPipe 配置：{steam_dir / 'steampipe'}）"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
