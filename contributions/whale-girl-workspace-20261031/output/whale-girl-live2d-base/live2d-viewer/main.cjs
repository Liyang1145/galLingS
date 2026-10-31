const fs = require('node:fs');
const path = require('node:path');
const logFile = path.join(__dirname, 'viewer-boot.log');
function logBoot(msg) {
  try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}
logBoot(`START versions=${JSON.stringify(process.versions)} ELECTRON_RUN_AS_NODE=${process.env.ELECTRON_RUN_AS_NODE}`);
process.on('uncaughtException', (e) => logBoot(`UNCAUGHT: ${e && e.stack || e}`));
process.on('unhandledRejection', (e) => logBoot(`UNHANDLED: ${e && e.stack || e}`));

const isElectron = Boolean(process.versions && process.versions.electron && !process.env.ELECTRON_RUN_AS_NODE);
const electron = isElectron ? require('electron') : null;
const app = electron ? electron.app : null;
const BrowserWindow = electron ? electron.BrowserWindow : null;
const http = require('node:http');
const { exec } = require('node:child_process');

const viewerRoot = __dirname;
const modelRoot = path.resolve(viewerRoot, '../../../real-lived/DeepSeek免费公皮/DeepSeek');
const sdkRoot = path.resolve(viewerRoot, 'sdk');
const bgRoot = path.resolve(viewerRoot, '../../../Seabreeze/game/images/scenes');

if (app) {
  app.setName('Whale Girl Live2D Viewer');
  app.setPath('userData', path.resolve(viewerRoot, '.userdata'));
}

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

async function startViewer() {
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

  await new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err && err.code === 'EADDRINUSE') {
        logBoot('Port 19880 in use, falling back to dynamic port 0');
        server.listen(0, '127.0.0.1', resolve);
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(19880, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  const actualPort = server.address().port;
  const url = `http://127.0.0.1:${actualPort}/`;
  logBoot(`Server listening on ${url}`);

  if (BrowserWindow) {
    win = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 900,
      minHeight: 650,
      title: '海风与布丁 · 鲸鱼小姐 Live2D 实时互动预览 (Cubism SDK 5)',
      backgroundColor: '#0b222d',
      autoHideMenuBar: true,
      alwaysOnTop: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await win.loadURL(url);
    win.show();
    win.focus();
    logBoot(`BrowserWindow loaded and shown: ${url}`);
  } else {
    exec(`start "" "${url}"`);
  }
  console.log(`VIEWER_READY ${url}`);
}

if (app) {
  app.whenReady().then(startViewer);
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => server?.close());
} else {
  startViewer();
}
