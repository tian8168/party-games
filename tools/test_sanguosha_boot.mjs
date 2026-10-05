import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();

// Simple static server
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqUrl = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname === '/') pathname = '/index.html';
  
  let filePath = path.join(rootDir, pathname);
  if (!fs.existsSync(filePath)) {
    // console.log('[404]', pathname);
    res.statusCode = 404;
    res.end('Not Found: ' + pathname);
    return;
  }

  let stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.end('Directory without index.html');
      return;
    }
  }

  let ext = path.extname(filePath).toLowerCase();
  let contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Service-Worker-Allowed', '/');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9222 + Math.floor(Math.random() * 1000);
  const targetUrl = `http://localhost:${port}/games/sanguosha/index.html`;

  console.log(`Starting Chrome CDP on port ${cdpPort}...`);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + path.join(rootDir, '.temp_chrome_profile_' + cdpPort),
    targetUrl
  ]);

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    try { chrome.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    try {
      fs.rmSync(path.join(rootDir, '.temp_chrome_profile_' + cdpPort), { recursive: true, force: true });
    } catch (e) {}
  }

  setTimeout(() => {
    console.log('Timeout reached, finishing capture.');
    cleanup();
    process.exit(0);
  }, 12000);

  // Poll for CDP endpoint
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

  if (!pageTarget) {
    console.error('Failed to connect to Chrome CDP.');
    cleanup();
    process.exit(1);
  }

  console.log('Connected to Chrome page:', pageTarget.url);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
  });

  ws.addEventListener('message', async (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        let args = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
        console.log(`[BROWSER CONSOLE ${msg.params.type}]`, args);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        console.log('[BROWSER DIALOG / ALERT]', msg.params.message);
        ws.send(JSON.stringify({ id: 99, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
      }
    } catch (e) {}
  });

  // After 6 seconds, click a character
  setTimeout(async () => {
    console.log('Clicking a character...');
    ws.send(JSON.stringify({
      id: 100,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          let btn = document.querySelector('.dialog .buttons > .button.character') || document.querySelector('.dialog .button');
          if (btn) {
            let name = btn.querySelector('.name')?.innerText || btn.innerText;
            btn.click();
            return 'Clicked button: ' + name;
          }
          return 'No button found';
        })()`,
        returnByValue: true
      }
    }));
  }, 6000);

  // After 9 seconds, evaluate gameplay state and take screenshot
  setTimeout(async () => {
    console.log('Evaluating in-game state and taking screenshot...');
    ws.send(JSON.stringify({
      id: 102,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          phase: window.game?.phaseName,
          allPlayers: window.game?.players?.map(p => ({
            position: p.dataset.position,
            name: p.name,
            identity: p.identity,
            avatarBg: p.node.avatar?.style.backgroundImage
          })),
          handcards: Array.from(document.querySelectorAll('#handcards1 .card, .handcards .card')).map(c => ({
            name: c.querySelector('.name')?.innerText,
            info: c.querySelector('.info')?.innerText,
            bg: c.style.backgroundImage
          })),
          controls: Array.from(document.querySelectorAll('#control .control, .control > *')).map(c => c.innerText)
        })`,
        returnByValue: true
      }
    }));

    ws.send(JSON.stringify({
      id: 101,
      method: 'Page.captureScreenshot',
      params: { format: 'png' }
    }));
  }, 9000);

  let messageHandler = (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.id === 100 || msg.id === 102) {
        console.log(`=== EVALUATION RESULT [${msg.id}] ===`);
        console.log(JSON.stringify(msg.result.result.value, null, 2));
      } else if (msg.id === 101) {
        let base64 = msg.result.data;
        fs.writeFileSync(path.join(rootDir, 'test_sgs_screenshot.png'), Buffer.from(base64, 'base64'));
        console.log('Screenshot saved to test_sgs_screenshot.png (' + base64.length + ' bytes base64)');
      }
    } catch (e) {}
  };
  ws.addEventListener('message', messageHandler);
});
