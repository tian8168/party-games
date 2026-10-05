import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  let reqUrl = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.join(rootDir, pathname);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  let stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  let ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Port: ${port}`);
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9800 + Math.floor(Math.random() * 100);

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--window-size=1280,720',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + path.join(rootDir, '.temp_modes_' + cdpPort),
    `http://localhost:${port}/games/sanguosha/index.html`
  ]);

  function cleanup() {
    try { chrome.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    try { fs.rmSync(path.join(rootDir, '.temp_modes_' + cdpPort), { recursive: true, force: true }); } catch (e) {}
  }

  setTimeout(() => {
    console.error('Timeout!');
    cleanup();
    process.exit(1);
  }, 25000);

  let pageTarget = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      let res = await fetch(`http://localhost:${cdpPort}/json`);
      let list = await res.json();
      pageTarget = list.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) break;
    } catch (e) {}
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
  });

  const errors = [];
  ws.addEventListener('message', (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails);
      }
    } catch (e) {}
  });

  // Wait 4s for boot
  await new Promise(r => setTimeout(r, 4000));

  // Inspect pauseconfig conditions
  ws.send(JSON.stringify({
    id: 80,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        return {
          auto_popped_config: window.lib?.config?.auto_popped_config,
          phonelayoutConfig: window.lib?.config?.phonelayout,
          isPhoneLayout: window.get?.is?.phoneLayout?.(),
          gameLayout: window.game?.layout,
          menuStyle: window.lib?.config?.menu_style
        };
      })()`,
      returnByValue: true
    }
  }));

  ws.addEventListener('message', (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.id === 80) {
        console.log('=== CHECK ALL.MODE ===', JSON.stringify(msg.result?.result?.value, null, 2));
        cleanup();
        process.exit(0);
      }
    } catch (e) {}
  });

  ws.addEventListener('message', (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.id === 50) {
        console.log('=== ENGINE STATE ===');
        console.log(JSON.stringify(msg.result?.result?.value, null, 2));
        console.log('Errors:', errors.length);
        cleanup();
        process.exit(0);
      }
    } catch (e) {}
  });
});
