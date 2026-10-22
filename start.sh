#!/usr/bin/env bash
# galLingS 一键启动（Linux / macOS）。第一次运行会建 .venv、装依赖、装确定性核心 galcore。
# 对应 Windows 的 start.bat；用法：在仓库根目录 `./start.sh`（或 `bash start.sh`）。
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '%s\n' "$*"; }
die() { say "$*" >&2; exit 1; }

# 必须放在 galLingS 仓库根目录（和 requirements.txt、server/ 在一起）运行
if [[ ! -f requirements.txt || ! -f server/__main__.py ]]; then
  die "这个 start.sh 不在 galLingS 文件夹里（旁边找不到 requirements.txt 和 server 文件夹）。请在 galLingS 仓库根目录运行。"
fi

PY=""
for c in python3.13 python3.12 python3.11 python3 python; do
  # 还要能建虚拟环境：Debian/Ubuntu 的 python3.x 没装 python3.x-venv 时缺 ensurepip，跳过它找下一个
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys, venv, ensurepip; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; then
    PY="$c"; break
  fi
done
VPY="$PWD/.venv/bin/python"

if [[ ! -x "$VPY" ]]; then
  [[ -n "$PY" ]] || die "没找到 Python 3.11+。Ubuntu/Debian：sudo apt install python3 python3-venv；Fedora：sudo dnf install python3；Arch：sudo pacman -S python"
  say "[1/4] 创建虚拟环境 .venv ..."
  "$PY" -m venv .venv || die "创建 .venv 失败。Ubuntu/Debian 需要先装 python3-venv：sudo apt install python3-venv"
fi
# galcore 轮子是 cp311-abi3：Python 低于 3.11 装不上（旧 .venv 也会被查出来）
"$VPY" -c 'import sys; sys.exit(sys.version_info < (3, 11))' \
  || die ".venv 里的 Python 低于 3.11。请安装 Python 3.11+，删掉本文件夹里的 .venv，再运行 ./start.sh"

say "[2/4] 安装 Python 依赖 ..."
"$VPY" -m pip install -q --disable-pip-version-check -r requirements.txt || die "安装失败，看上面的报错。"

if ! "$VPY" -c 'import galcore' 2>/dev/null; then
  say "[3/4] 安装确定性核心 galcore（Rust）..."
  if compgen -G "wheels/galcore-*linux*.whl" >/dev/null || compgen -G "wheels/galcore-*macosx*.whl" >/dev/null; then
    "$VPY" -m pip install -q --no-index --find-links wheels galcore || die "galcore 轮子装不上（可能是 CPU 架构不对），删掉 wheels/ 里的 Linux 轮子后重试会改为本机编译。"
  else
    command -v cargo >/dev/null 2>&1 || die "没有 galcore 轮子，也没有 Rust 编译器。二选一：
  1. 从 GitHub Actions 下载 galcore-ubuntu-latest 里的 .whl，放进本目录的 wheels/ 文件夹，再运行本脚本；
  2. 安装 Rust（https://rustup.rs）和 C 编译器（sudo apt install build-essential），再运行本脚本自动编译。"
    "$VPY" -m pip install -q maturin || die "安装 maturin 失败。"
    (cd core && "$VPY" -m maturin build --release --out ../wheels) || die "galcore 编译失败，看上面的报错。"
    "$VPY" -m pip install -q --no-index --find-links wheels galcore || die "galcore 安装失败。"
  fi
else
  say "[3/4] galcore 已安装"
fi

if [[ ! -f content/scripts/ch01/ch01.md ]]; then
  say "提示：没有剧本内容包 content/scripts/ch01，后端 AI 剧本会话不能用；作品页 /vn.html 里的作品照常可玩。"
fi

# 已经在作品页 ⚙ 设置里保存过密钥，就不用每次再问
if ! grep -q GALLINGS_LLM_API_KEY "$HOME/.gallings/secrets.json" 2>/dev/null && [[ -z "${GALLINGS_LLM_API_KEY:-}" && -t 0 ]]; then
  say ""
  say "没有设置 GALLINGS_LLM_API_KEY：不填则后端 AI 功能不可用。key 只在这次运行里有效，不会写进任何文件。"
  say "也可以以后在 作品页 右上角 ⚙ 设置 里填，填一次就记住（只存在本机）。"
  read -r -s -p "输入 DeepSeek API key（直接回车跳过）：" GALLINGS_LLM_API_KEY || true
  say ""
  export GALLINGS_LLM_API_KEY
fi

say "[4/4] 启动后端：有作品时浏览器打开作品页 http://127.0.0.1:8765/vn.html ，否则打开 API 文档 /docs"
exec "$VPY" -m server "$@"
