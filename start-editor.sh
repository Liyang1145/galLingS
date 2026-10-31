#!/usr/bin/env bash
# Linux / macOS 剧情编辑入口：与 start-editor.bat 相同。
set -u
cd "$(dirname "$0")" || exit 1
fail() { printf '%s\n' "$@" >&2; exit 1; }
[ -f package.json ] && [ -f content/story/project.json ] && [ -f apps/editor/index.html ] && [ -f tools/editor/vite.config.ts ] \
  || fail "请在完整仓库根目录使用本脚本，保留 package.json、content、apps 和 tools。"
command -v node >/dev/null 2>&1 || fail "没找到 Node.js，请先安装 Node.js 24.15.0 或更新的 24.x 版本。"
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major === 24 && minor >= 15 ? 0 : 1)" \
  || fail "当前 Node.js 版本不符合要求，请使用 24.15.0 或更新的 24.x 版本。"
command -v npm >/dev/null 2>&1 || fail "没找到 npm，请修复 Node.js 的 npm 安装和 PATH 配置。"
[ -x node_modules/.bin/vite ] && [ -f node_modules/vite/bin/vite.js ] \
  || fail "缺少编辑器开发依赖，请先在仓库目录执行以下命令，再运行本脚本：" "  npm ci --ignore-scripts"
echo "正在启动《海风与布丁》剧情编辑器..."
echo "编辑器就绪后会自动打开浏览器；本终端请保持开启。"
echo "草稿只保留在页面中，请在关闭前保存到作者源或导出草稿。"
echo "结束编辑后，在本终端按 Ctrl+C。"
echo
npm run editor:dev -- --open || fail "编辑器启动失败，请查看上方错误。" "如果提示 5174 端口已被占用，请先保存草稿，再关闭之前的编辑器启动终端后重试。"
