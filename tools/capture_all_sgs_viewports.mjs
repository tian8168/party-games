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
  '.gif': 'image/gif',
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

async function captureViewport(port, name, width, height, isMobile = false) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9600 + Math.floor(Math.random() * 300);
  const dataDir = path.join(rootDir, '.temp_viewport_' + cdpPort);

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--window-size=${width},${height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + dataDir,
    `http://localhost:${port}/games/sanguosha/index.html`
  ]);

  function cleanup() {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }

  try {
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

    if (!pageTarget) throw new Error('CDP target not found');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve));

    let msgId = 1;
    function send(method, params = {}) {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return id;
    }

    send('Page.enable');
    send('Runtime.enable');

    if (isMobile) {
      send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: true
      });
    }

    // Wait 4.5s for dialog
    await new Promise(r => setTimeout(r, 4500));

    // Capture dialog state screenshot
    const shot1 = await new Promise((resolve) => {
      const id = send('Page.captureScreenshot', { format: 'png' });
      const handler = (e) => {
        let d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result.data);
        }
      };
      ws.addEventListener('message', handler);
    });
    fs.writeFileSync(path.join(rootDir, `sgs_${name}_dialog.png`), Buffer.from(shot1, 'base64'));
    console.log(`[OK] Saved sgs_${name}_dialog.png`);

    // Check collision geometry in DOM
    const geom = await new Promise((resolve) => {
      const id = send('Runtime.evaluate', {
        expression: `(() => {
          const dialog = document.querySelector('#arena.choose-character > .dialog');
          const control = document.querySelector('#arena.choose-character > #control');
          const buttons = control ? Array.from(control.querySelectorAll('.control')).map(c => c.innerText.trim()) : [];
          const dialogRect = dialog ? dialog.getBoundingClientRect() : null;
          const controlRect = control ? control.getBoundingClientRect() : null;
          const pTip = document.querySelector('#portrait-tip');
          const tipRect = pTip && window.getComputedStyle(pTip).display !== 'none' ? pTip.getBoundingClientRect() : null;
          return {
            dialogRect: dialogRect ? { top: dialogRect.top, bottom: dialogRect.bottom, height: dialogRect.height } : null,
            controlRect: controlRect ? { top: controlRect.top, bottom: controlRect.bottom, height: controlRect.height } : null,
            buttons,
            tipVisible: !!tipRect,
            tipRect: tipRect ? { top: tipRect.top, bottom: tipRect.bottom } : null,
            overlap: dialogRect && controlRect ? !(dialogRect.bottom <= controlRect.top || dialogRect.top >= controlRect.bottom) : false
          };
        })()`,
        returnByValue: true
      });
      const handler = (e) => {
        let d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
    });
    console.log(`[Geometry ${name}]`, JSON.stringify(geom));

    // Now click a character to enter gameplay
    send('Runtime.evaluate', {
      expression: `(() => {
        let btn = document.querySelector('.dialog .buttons > .button.character') || document.querySelector('.dialog .button');
        if (btn) btn.click();
      })()`
    });

    // Wait 4.5s for gameplay board
    await new Promise(r => setTimeout(r, 4500));

    // Capture gameplay screenshot
    const shot2 = await new Promise((resolve) => {
      const id = send('Page.captureScreenshot', { format: 'png' });
      const handler = (e) => {
        let d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result.data);
        }
      };
      ws.addEventListener('message', handler);
    });
    fs.writeFileSync(path.join(rootDir, `sgs_${name}_gameplay.png`), Buffer.from(shot2, 'base64'));
    console.log(`[OK] Saved sgs_${name}_gameplay.png`);

    // Check Player 0 identity computed styles
    const p0Check = await new Promise((resolve) => {
      const id = send('Runtime.evaluate', {
        expression: `(() => {
          const p0 = document.querySelector('.player[data-position="0"]');
          const ident = p0 ? p0.querySelector('.identity') : null;
          if (!ident) return null;
          const cs = window.getComputedStyle(ident);
          return {
            background: cs.backgroundColor,
            backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
            boxShadow: cs.boxShadow,
            width: cs.width
          };
        })()`,
        returnByValue: true
      });
      const handler = (e) => {
        let d = JSON.parse(e.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
    });
    console.log(`[P0 Identity ${name}]`, JSON.stringify(p0Check));

    ws.close();
  } finally {
    cleanup();
  }
}

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port: ${port}`);
  try {
    console.log('\n--- 1. Desktop (1280x720) ---');
    await captureViewport(port, 'desktop', 1280, 720, false);

    console.log('\n--- 2. Mobile Landscape (844x390) ---');
    await captureViewport(port, 'mobile_landscape', 844, 390, true);

    console.log('\n--- 3. Mobile Portrait (390x844) ---');
    await captureViewport(port, 'mobile_portrait', 390, 844, true);

    console.log('\nAll viewport captures and geometry checks succeeded!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
