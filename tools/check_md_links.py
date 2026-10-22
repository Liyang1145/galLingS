#!/usr/bin/env python3
"""检查仓库内所有 .md 的相对链接是否指向存在的文件或目录。

用法：
  python tools/check_md_links.py               # 检查工作区（git ls-files 列出的 .md）
  python tools/check_md_links.py --rev <提交>   # 不 checkout，直接检查某个提交（适合 blobless 浅克隆）

跳过：外链（http:、mailto: 等）、页内锚点（#...）、代码块里的内容、作品文件夹 海风与布丁/。
有断链时列出「文件 -> 链接」并以退出码 1 结束。
"""
import os, posixpath, re, subprocess, sys, urllib.parse

LINK = re.compile(r'\]\((?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\)')
SKIP = ('海风与布丁/',)


def git(*a):
    return subprocess.run(['git', '-c', 'core.quotepath=off', *a], capture_output=True, check=True).stdout.decode('utf8')


def main():
    rev = sys.argv[sys.argv.index('--rev') + 1] if '--rev' in sys.argv else None
    root = git('rev-parse', '--show-toplevel').strip()
    os.chdir(root)
    paths = git('ls-tree', '-r', '--name-only', rev).splitlines() if rev else git('ls-files').splitlines()
    files = set(paths)
    dirs = set()
    for p in paths:
        d = posixpath.dirname(p)
        while d:
            dirs.add(d)
            d = posixpath.dirname(d)
    if not rev:  # 工作区里新加但未跟踪的文件也算存在
        files |= {p for p in git('ls-files', '--others', '--exclude-standard').splitlines()}
    bad, n = [], 0
    for p in sorted(files):
        if not p.endswith('.md') or p.startswith(SKIP):
            continue
        txt = git('show', f'{rev}:{p}') if rev else open(p, encoding='utf8').read()
        txt = re.sub(r'```.*?```', '', txt, flags=re.S)
        for m in LINK.finditer(txt):
            t = m.group(1) or m.group(2)
            if re.match(r'^[a-z][a-z0-9+.-]*:', t, re.I) or t.startswith('#'):
                continue
            t = urllib.parse.unquote(t.split('#')[0])
            if not t:
                continue
            n += 1
            tgt = posixpath.normpath(posixpath.join(posixpath.dirname(p), t)).rstrip('/')
            if tgt not in files and tgt not in dirs:
                bad.append((p, t))
    print(f'检查链接 {n} 条，断链 {len(bad)} 条')
    for p, t in bad:
        print(f'  {p} -> {t}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
