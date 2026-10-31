#!/usr/bin/env bash
# Linux / macOS 游玩入口：与 start.bat 相同，只启动新版开发服务并打开浏览器。
set -u
cd "$(dirname "$0")" || exit 1
fail() { printf '%s\n' "$@" >&2; exit 1; }
[ -f package.json ] && [ -f content/story/project.json ] && [ -f tools/dev/vite.config.ts ] \
  || fail "请在完整仓库根目录使用本脚本，保留 package.json、content 和 tools。"
command -v node >/dev/null 2>&1 || fail "没找到 Node.js，请先安装 Node.js 24.15.0 或更新的 24.x 版本。"
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major === 24 && minor >= 15 ? 0 : 1)" \
  || fail "当前 Node.js 版本不符合要求，请使用 24.15.0 或更新的 24.x 版本。"
command -v npm >/dev/null 2>&1 || fail "没找到 npm，请修复 Node.js 的 npm 安装和 PATH 配置。"
[ -x node_modules/.bin/vite ] && [ -f node_modules/vite/bin/vite.js ] \
  || fail "缺少游戏开发依赖，请先在仓库目录执行以下命令，再运行本脚本：" "  npm ci --ignore-scripts"
echo "正在启动《海风与布丁》..."
echo "游戏就绪后会自动打开浏览器；本终端请保持开启。"
echo "结束游玩时，在本终端按 Ctrl+C。"
echo
npm run game:dev -- --open || fail "游戏启动失败，请查看上方错误。" "如果提示 5173 端口已被占用，请关闭之前的游戏启动终端后重试。"
