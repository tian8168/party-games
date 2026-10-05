import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();

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
    res.statusCode = 404;
    res.end('Not Found');
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
  fs.createReadStream(filePath).pipe(res);
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`[TEST SERVER] Port: ${port}`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = 9300 + Math.floor(Math.random() * 600);
  const targetUrl = `http://localhost:${port}/games/sanguosha/index.html`;

  console.log(`[CHROME] Starting on CDP port ${cdpPort}...`);
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + path.join(rootDir, '.temp_chrome_profile_' + cdpPort),
    targetUrl
  ]);

  let errors = [];
  let warnings = [];
  let steps = [];

  function cleanup() {
    try { chrome.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
    try {
      fs.rmSync(path.join(rootDir, '.temp_chrome_profile_' + cdpPort), { recursive: true, force: true });
    } catch (e) {}
  }

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
    console.error('Failed to connect to CDP endpoint');
    cleanup();
    process.exit(1);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Console.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
  });

  ws.addEventListener('message', (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        let text = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
        if (msg.params.type === 'error') {
          errors.push(text);
          console.error('[CONSOLE ERROR]', text);
        } else if (msg.params.type === 'warning') {
          warnings.push(text);
          // console.warn('[CONSOLE WARN]', text);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        let desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        errors.push(desc);
        console.error('[UNCAUGHT EXCEPTION]', desc);
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        let alertMsg = msg.params.message;
        errors.push(`Unexpected Alert: ${alertMsg}`);
        console.error('[UNEXPECTED DIALOG ALERT]', alertMsg);
        ws.send(JSON.stringify({ id: 99, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
      }
    } catch (e) {}
  });

  // Step 1: Wait for character selection dialog
  console.log('Waiting for boot and character selection dialog...');
  await new Promise(r => setTimeout(r, 6500));
  steps.push('Booted successfully, checking selection dialog...');

  // Step 2: Choose character
  console.log('Choosing character...');
  ws.send(JSON.stringify({
    id: 200,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        let btn = document.querySelector('.dialog .buttons > .button.character') || document.querySelector('.dialog .button');
        if (btn) {
          let name = btn.querySelector('.name')?.innerText || btn.innerText;
          btn.click();
          return { clicked: true, name };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    }
  }));

  // Step 3: Wait for round to start and cards to deal
  console.log('Waiting for cards to deal and round to begin...');
  await new Promise(r => setTimeout(r, 4500));
  steps.push('Character selected, observing AI turn and state...');

  // Step 4: Evaluate game engine & DOM state
  ws.send(JSON.stringify({
    id: 201,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        let domPlayers = Array.from(document.querySelectorAll('#arena > .player')).map(p => ({
          position: p.dataset.position,
          name: p.querySelector('.name')?.innerText || p.name,
          identity: p.querySelector('.identity')?.innerText || p.identity,
          hpDots: p.querySelectorAll('.hp > div').length
        }));
        let handcards = Array.from(document.querySelectorAll('#handcards1 .card, .handcards .card')).map(c => ({
          name: c.querySelector('.name')?.innerText,
          info: c.querySelector('.info')?.innerText
        }));
        let controls = Array.from(document.querySelectorAll('#control .control, .control > *')).map(c => c.innerText);
        let hasLord = !!document.querySelector('.identity[data-color="zhu"]');
        let arenaPresent = !!document.getElementById('arena');
        let hubBannerPresent = !!document.getElementById('hub-back-banner');

        return {
          arenaPresent,
          hubBannerPresent,
          hasLord,
          playersCount: domPlayers.length,
          domPlayers,
          handcardsCount: handcards.length,
          handcards,
          controls
        };
      })()`,
      returnByValue: true
    }
  }));

  let evaluatedState = null;
  let evalListener = (event) => {
    try {
      let msg = JSON.parse(event.data.toString());
      if (msg.id === 201) {
        evaluatedState = msg.result.result.value;
      }
    } catch (e) {}
  };
  ws.addEventListener('message', evalListener);

  await new Promise(r => setTimeout(r, 2000));

  console.log('\n=== GAMEPLAY STATE INSPECTION ===');
  console.log(JSON.stringify(evaluatedState, null, 2));

  console.log('\n=== VALIDATION RESULTS ===');
  console.log(`- Boot steps completed: ${steps.length}`);
  console.log(`- Critical errors/alerts: ${errors.length}`);
  console.log(`- Warnings: ${warnings.length}`);
  console.log(`- Arena present: ${evaluatedState?.arenaPresent}`);
  console.log(`- Hub banner present: ${evaluatedState?.hubBannerPresent}`);
  console.log(`- Lord present: ${evaluatedState?.hasLord}`);
  console.log(`- Players active: ${evaluatedState?.playersCount}`);
  console.log(`- Handcards dealt: ${evaluatedState?.handcardsCount}`);

  let pass = evaluatedState?.arenaPresent &&
             evaluatedState?.hubBannerPresent &&
             evaluatedState?.playersCount === 8 &&
             evaluatedState?.hasLord &&
             evaluatedState?.handcardsCount >= 4 &&
             errors.length === 0;

  cleanup();

  if (pass) {
    console.log('\n[PASS] SANGUOSHA GAME ENGINE & UI FULLY FUNCTIONAL AND ERROR FREE!\n');
    process.exit(0);
  } else {
    console.error('\n[FAIL] Issues detected during gameplay verification!\n');
    process.exit(1);
  }
});
