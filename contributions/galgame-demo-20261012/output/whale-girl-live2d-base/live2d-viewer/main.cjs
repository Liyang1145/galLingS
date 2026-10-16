const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const viewerRoot = __dirname;
const modelRoot = path.resolve(viewerRoot, '../runtime-test-v6-body-x-wip');
const sdkRoot = path.resolve(viewerRoot, '../../../../galagent/prototypes/live2d/vendor/CubismSdkForWeb-5-r.5');
const bgRoot = path.resolve(viewerRoot, '../../../Seabreeze/game/images/scenes');

app.setName('Whale Girl Live2D Viewer');
app.setPath('userData', path.resolve(viewerRoot, '.userdata'));

let win, server;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.vert': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.moc3': 'application/octet-stream'
};

function resolveMount(pathname) {
  if (pathname.startsWith('/sdk/')) {
    return { base: sdkRoot, rel: pathname.slice('/sdk/'.length) };
  }
  if (pathname.startsWith('/model/')) {
    return { base: modelRoot, rel: pathname.slice('/model/'.length) };
  }
  if (pathname.startsWith('/bg/')) {
    return { base: bgRoot, rel: pathname.slice('/bg/'.length) };
  }
  return { base: viewerRoot, rel: pathname === '/' ? 'index.html' : pathname.slice(1) };
}

app.whenReady().then(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(urlObj.pathname);

      if (pathname === '/api/reload' && win) {
        await win.webContents.reloadIgnoringCache();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (pathname === '/api/screenshot' && win) {
        const outPath = urlObj.searchParams.get('out') || path.join(viewerRoot, 'viewer-capture.png');
        const image = await win.webContents.capturePage();
        fs.writeFileSync(outPath, image.toPNG());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, outPath }));
        return;
      }

      if (pathname === '/api/pose' && win) {
        const pose = urlObj.searchParams.get('pose') || '';
        const view = urlObj.searchParams.get('view') || '';
        await win.webContents.executeJavaScript(
          `window.viewerAPI && window.viewerAPI.setPreset(${JSON.stringify(pose)}, ${JSON.stringify(view)})`
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, pose, view }));
        return;
      }

      const mount = resolveMount(pathname);
      const targetFile = path.resolve(mount.base, mount.rel);
      if (!targetFile.toLowerCase().startsWith(mount.base.toLowerCase())) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
        res.writeHead(404);
        res.end('Not found: ' + pathname);
        return;
      }
      const ext = path.extname(targetFile).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      fs.createReadStream(targetFile).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  const port = 19880;
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    title: '海风与布丁 · 鲸鱼小姐 Live2D 实时互动预览 (Cubism SDK 5)',
    backgroundColor: '#0b222d',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
  win.show();
  win.focus();
  console.log(`VIEWER_READY http://127.0.0.1:${port}/`);
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => server?.close());
