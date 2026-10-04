const COLS = 15;
const ROWS = 13;
const CELL = 48;

const CELL_EMPTY = 0;
const CELL_HARD = 1;
const CELL_SOFT = 2;

let canvas, ctx;
let gameRunning = false;
let lastTs = 0;
let grid = [];
let players = [];
let bombs = [];
let explosions = [];
let groundItems = [];
let floatingTexts = [];

let humanPlayersCount = 2;
let targetWins = 2; 
let currentRound = 1;
let matchOver = false;

let roundTimer = 180000; 
let suddenDeathActive = false;
let suddenDeathTimer = 0;
const SUDDEN_DEATH_INTERVAL = 800;
let suddenDeathStep = 0;
let suddenDeathPath = [];

const ITEMS = [
  { type:'bomb',  icon:'💣', color:'#f97316', weight:30, apply(p){ p.maxBombs = Math.min(p.maxBombs+1, 6); } },
  { type:'fire',  icon:'🔥', color:'#ef4444', weight:30, apply(p){ p.fireRange = Math.min(p.fireRange+1, 8); } },
  { type:'speed', icon:'🛼', color:'#06b6d4', weight:20, apply(p){ p.speed = Math.min(p.speed+0.8, 5.5); p.speedLevel = Math.min(p.speedLevel+1,3); } },
  { type:'kick',  icon:'👟', color:'#8b5cf6', weight:10, apply(p){ p.hasKick = true; } },
  { type:'throw', icon:'🥊', color:'#ec4899', weight:5,  apply(p){ p.hasThrow = true; } },
  { type:'skull', icon:'☠️', color:'#6b7280', weight:5,  apply(p){ applyCurse(p); } }
];

const CONTROLS = [
  { up:'w', down:'s', left:'a', right:'d', bomb:' ', kick:'e' },
  { up:'arrowup', down:'arrowdown', left:'arrowleft', right:'arrowright', bomb:'enter', kick:'\\' },
  { up:'i', down:'k', left:'j', right:'l', bomb:'o', kick:'p' },
  { up:'8', down:'5', left:'4', right:'6', bomb:'+', kick:'0' }
];

function applyCurse(p) {
  p.cursed = true;
  p.curseDuration = 10000;
  const curses = ['slow', 'reverse', 'auto_bomb'];
  p.curseType = curses[Math.floor(Math.random() * curses.length)];
}

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (let i=0; i<items.length; i++) {
    r -= items[i].weight;
    if (r <= 0) return items[i];
  }
  return items[0];
}

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('bm-canvas');
  ctx = canvas.getContext('2d');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  
  setupUI();
  setupInput();
  
  // Register audio if not already
  if (window.AUDIO) {
    // Stubs if actual audio is missing
  }
});

function setupUI() {
  const pBtns = document.querySelectorAll('.bm-player-toggle');
  pBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      pBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      humanPlayersCount = i + 1;
    });
  });
  
  const rBtns = [document.getElementById('bm-btn-r3'), document.getElementById('bm-btn-r5'), document.getElementById('bm-btn-r7')];
  rBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      rBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      targetWins = i === 0 ? 2 : i === 1 ? 3 : 4;
    });
  });

  document.getElementById('bm-btn-start').addEventListener('click', () => {
    startBombermanGame(true);
  });
  
  // Mobile touch
  const ctrls = document.querySelectorAll('.ctrl-btn');
  ctrls.forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleTouch(btn.dataset.key, true);
    }, {passive: false});
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleTouch(btn.dataset.key, false);
    }, {passive: false});
  });
}

function handleTouch(action, state) {
  if (humanPlayersCount > 0 && players[0] && players[0].alive) {
    players[0].keys[action] = state;
  }
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (key.startsWith('arrow')) key = key.toLowerCase();
    for (let i=0; i<4; i++) {
      if (i >= humanPlayersCount) continue;
      const c = CONTROLS[i];
      if (Object.values(c).includes(key)) {
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'enter'].includes(key)) e.preventDefault();
        const action = Object.keys(c).find(k => c[k] === key);
        if (players[i]) players[i].keys[action] = true;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    for (let i=0; i<4; i++) {
      if (i >= humanPlayersCount) continue;
      const c = CONTROLS[i];
      if (Object.values(c).includes(key)) {
        const action = Object.keys(c).find(k => c[k] === key);
        if (players[i]) players[i].keys[action] = false;
      }
    }
  });
}

function initMap() {
  grid = [];
  for (let r=0; r<ROWS; r++) {
    let row = [];
    for (let c=0; c<COLS; c++) {
      if (r===0 || r===ROWS-1 || c===0 || c===COLS-1) row.push(CELL_HARD);
      else if (r%2===0 && c%2===0) row.push(CELL_HARD);
      else row.push(CELL_EMPTY);
    }
    grid.push(row);
  }

  const safeZones = [
    [1,1],[1,2],[2,1],
    [1,COLS-2],[1,COLS-3],[2,COLS-2],
    [ROWS-2,1],[ROWS-2,2],[ROWS-3,1],
    [ROWS-2,COLS-2],[ROWS-2,COLS-3],[ROWS-3,COLS-2]
  ];

  for (let r=1; r<ROWS-1; r++) {
    for (let c=1; c<COLS-1; c++) {
      if (grid[r][c] === CELL_EMPTY) {
        let isSafe = safeZones.some(z => z[0]===r && z[1]===c);
        if (!isSafe && Math.random() < 0.6) {
          grid[r][c] = CELL_SOFT;
        }
      }
    }
  }
}

function generateSuddenDeathPath() {
  suddenDeathPath = [];
  let t=1, b=ROWS-2, l=1, r=COLS-2;
  while(t<=b && l<=r) {
    for(let c=l; c<=r; c++) suddenDeathPath.push({c, r:t}); t++;
    for(let r2=t; r2<=b; r2++) suddenDeathPath.push({c:r, r:r2}); r--;
    for(let c=r; c>=l; c--) suddenDeathPath.push({c, r:b}); b--;
    for(let r2=b; r2>=t; r2--) suddenDeathPath.push({c:l, r:r2}); l++;
  }
}

window.startBombermanGame = function(resetScores = false) {
  initMap();
  generateSuddenDeathPath();
  bombs = [];
  explosions = [];
  groundItems = [];
  floatingTexts = [];
  roundTimer = 180000;
  suddenDeathActive = false;
  suddenDeathTimer = 0;
  suddenDeathStep = 0;

  if (resetScores) {
    currentRound = 1;
    matchOver = false;
    document.getElementById('bm-victory-overlay').style.display = 'none';
  }

  const spawns = [
    {c:1, r:1, color:'#ff4757'},
    {c:COLS-2, r:1, color:'#2ed573'},
    {c:1, r:ROWS-2, color:'#1e90ff'},
    {c:COLS-2, r:ROWS-2, color:'#ffa502'}
  ];

  let newPlayers = [];
  for (let i=0; i<4; i++) {
    let oldScore = resetScores ? 0 : (players[i] ? players[i].score : 0);
    newPlayers.push({
      id: i,
      color: spawns[i].color,
      x: spawns[i].c * CELL + CELL/2,
      y: spawns[i].r * CELL + CELL/2,
      col: spawns[i].c,
      row: spawns[i].r,
      dx: 0, dy: 0,
      speed: 2.5,
      alive: true,
      score: oldScore,
      maxBombs: 1,
      activeBombs: 0,
      fireRange: 2,
      speedLevel: 1,
      hasKick: false,
      hasThrow: false,
      cursed: false,
      curseType: null,
      curseDuration: 0,
      isHuman: i < humanPlayersCount,
      keys: { up:false, down:false, left:false, right:false, bomb:false, kick:false }
    });
  }
  players = newPlayers;

  updateHUD();
  showOverlay(`ROUND ${currentRound}`);
  
  setTimeout(() => {
    document.getElementById('bm-overlay').style.display = 'none';
    lastTs = performance.now();
    if (!gameRunning) {
      gameRunning = true;
      requestAnimationFrame(gameLoop);
    }
  }, 2000);
}

window.restartBombermanGame = function() {
  startBombermanGame(true);
}

function showOverlay(text) {
  const overlay = document.getElementById('bm-overlay');
  overlay.style.display = 'flex';
  document.getElementById('bm-overlay-text').textContent = text;
}

function gameLoop(ts) {
  if (!gameRunning) return;
  const dt = Math.min(ts - lastTs, 50);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  roundTimer -= dt;
  if (roundTimer <= 45000 && !suddenDeathActive) {
    suddenDeathActive = true;
    if (window.AUDIO) AUDIO.play('bm_warning');
  }

  if (suddenDeathActive) {
    suddenDeathTimer += dt;
    if (suddenDeathTimer >= SUDDEN_DEATH_INTERVAL) {
      suddenDeathTimer = 0;
      spawnNextSuddenDeathWall();
    }
  }

  updatePlayers(dt);
  updateBombs(dt);
  updateExplosions(dt);
  updateItems();
  updateFloatingTexts(dt);
  checkWinCondition();
}

const PLAYER_RADIUS = 16;
const SLIDE_THRESHOLD = 18;

function spawnNextSuddenDeathWall() {
  while (suddenDeathStep < suddenDeathPath.length) {
    let p = suddenDeathPath[suddenDeathStep++];
    if (grid[p.r][p.c] !== CELL_HARD) {
      grid[p.r][p.c] = CELL_HARD;
      // Kill any player crushed by falling wall
      players.forEach(player => {
        if (player.alive) {
          let minC = Math.floor((player.x - PLAYER_RADIUS) / CELL);
          let maxC = Math.floor((player.x + PLAYER_RADIUS) / CELL);
          let minR = Math.floor((player.y - PLAYER_RADIUS) / CELL);
          let maxR = Math.floor((player.y + PLAYER_RADIUS) / CELL);
          if (p.c >= minC && p.c <= maxC && p.r >= minR && p.r <= maxR) {
            killPlayer(player);
          }
        }
      });
      break;
    }
  }
}

function getCell(px) { return Math.floor(px / CELL); }

function isSolid(c, r, p) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
  if (grid[r][c] === CELL_HARD || grid[r][c] === CELL_SOFT) return true;
  for (let b of bombs) {
    if (b.col === c && b.row === r) {
      if (b.passablePlayers && b.passablePlayers.has(p.id)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function boxCollides(x, y, p) {
  const minC = Math.floor((x - PLAYER_RADIUS) / CELL);
  const maxC = Math.floor((x + PLAYER_RADIUS) / CELL);
  const minR = Math.floor((y - PLAYER_RADIUS) / CELL);
  const maxR = Math.floor((y + PLAYER_RADIUS) / CELL);
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (isSolid(c, r, p)) return true;
    }
  }
  return false;
}

function movePlayer(p, moveX, moveY, speed) {
  if (moveX !== 0 && moveY !== 0) {
    moveX = 0; // Enforce single-axis movement to eliminate diagonal wall-pinching
  }

  // Handle kicking bombs when walking into them
  if (p.hasKick && !p.cursed) {
    const checkC = Math.floor((p.x + moveX * (PLAYER_RADIUS + 8)) / CELL);
    const checkR = Math.floor((p.y + moveY * (PLAYER_RADIUS + 8)) / CELL);
    const hitBomb = bombs.find(b => b.col === checkC && b.row === checkR && !b.kicked);
    if (hitBomb) {
      hitBomb.kicked = true;
      hitBomb.kickDx = moveX;
      hitBomb.kickDy = moveY;
    }
  }

  // 1. Direct movement attempt
  const targetX = p.x + moveX * speed;
  const targetY = p.y + moveY * speed;
  if (!boxCollides(targetX, targetY, p)) {
    p.x = targetX;
    p.y = targetY;
    return;
  }

  // 2. Safe assisted cornering (smoothly guide player into perpendicular corridors without wall clipping)
  if (moveX !== 0) {
    const currentR = Math.floor(p.y / CELL);
    const centerY = currentR * CELL + CELL / 2;
    const diffY = centerY - p.y;
    if (Math.abs(diffY) <= SLIDE_THRESHOLD && Math.abs(diffY) > 0.01) {
      const slideDir = diffY > 0 ? 1 : -1;
      const slideY = p.y + slideDir * Math.min(speed, Math.abs(diffY));
      if (!boxCollides(p.x, slideY, p)) {
        p.y = slideY;
        if (!boxCollides(p.x + moveX * speed, p.y, p)) {
          p.x += moveX * speed;
        }
      }
    }
  } else if (moveY !== 0) {
    const currentC = Math.floor(p.x / CELL);
    const centerX = currentC * CELL + CELL / 2;
    const diffX = centerX - p.x;
    if (Math.abs(diffX) <= SLIDE_THRESHOLD && Math.abs(diffX) > 0.01) {
      const slideDir = diffX > 0 ? 1 : -1;
      const slideX = p.x + slideDir * Math.min(speed, Math.abs(diffX));
      if (!boxCollides(slideX, p.y, p)) {
        p.x = slideX;
        if (!boxCollides(p.x, p.y + moveY * speed, p)) {
          p.y += moveY * speed;
        }
      }
    }
  }
}

function updatePlayers(dt) {
  for (let p of players) {
    if (!p.alive) continue;

    if (p.cursed) {
      p.curseDuration -= dt;
      if (p.curseDuration <= 0) {
        p.cursed = false;
        p.curseType = null;
      }
      if (p.curseType === 'auto_bomb' && Math.random() < 0.05) p.keys.bomb = true;
    }

    if (!p.isHuman) {
      updateAI(p, dt);
    }

    let speed = p.speed;
    if (p.cursed && p.curseType === 'slow') speed *= 0.5;

    let moveX = 0, moveY = 0;
    if (p.keys.up) moveY = -1;
    else if (p.keys.down) moveY = 1;
    if (p.keys.left) moveX = -1;
    else if (p.keys.right) moveX = 1;

    if (p.cursed && p.curseType === 'reverse') {
      moveX = -moveX; moveY = -moveY;
    }

    if (moveX !== 0 || moveY !== 0) {
      movePlayer(p, moveX, moveY, speed);
    }
    
    p.col = Math.floor(p.x / CELL);
    p.row = Math.floor(p.y / CELL);

    if (p.keys.bomb && p.activeBombs < p.maxBombs) {
      placeBomb(p);
      p.keys.bomb = false; 
    }
  }
}

function placeBomb(p) {
  let c = p.col;
  let r = p.row;
  if (bombs.some(b => b.col === c && b.row === r)) return;

  p.activeBombs++;
  bombs.push({
    col: c, row: r,
    x: c * CELL + CELL/2,
    y: r * CELL + CELL/2,
    ownerId: p.id,
    fuseTime: 3000,
    fireRange: p.fireRange,
    kicked: false,
    kickDx: 0, kickDy: 0,
    thrown: false,
    glowing: true,
    passablePlayers: new Set([p.id])
  });
  if (window.AUDIO) AUDIO.play('bm_place');
  updateHUD();
}

function updateBombs(dt) {
  // Update bomb passability: once player has stepped off the bomb cell, remove from passablePlayers
  for (let b of bombs) {
    if (b.passablePlayers && b.passablePlayers.size > 0) {
      for (let pid of Array.from(b.passablePlayers)) {
        let player = players[pid];
        if (!player || !player.alive) {
          b.passablePlayers.delete(pid);
          continue;
        }
        let pMinC = Math.floor((player.x - PLAYER_RADIUS) / CELL);
        let pMaxC = Math.floor((player.x + PLAYER_RADIUS) / CELL);
        let pMinR = Math.floor((player.y - PLAYER_RADIUS) / CELL);
        let pMaxR = Math.floor((player.y + PLAYER_RADIUS) / CELL);
        if (b.col < pMinC || b.col > pMaxC || b.row < pMinR || b.row > pMaxR) {
          b.passablePlayers.delete(pid);
        }
      }
    }
  }

  for (let i = bombs.length - 1; i >= 0; i--) {
    let b = bombs[i];
    b.fuseTime -= dt;

    if (b.kicked) {
      let speed = 5;
      let nextX = b.x + b.kickDx * speed;
      let nextY = b.y + b.kickDy * speed;
      let nextC = Math.floor((nextX + Math.sign(b.kickDx) * CELL / 2) / CELL);
      let nextR = Math.floor((nextY + Math.sign(b.kickDy) * CELL / 2) / CELL);
      
      if (isSolidForBomb(nextC, nextR)) {
        b.kicked = false;
        b.col = Math.floor(b.x / CELL);
        b.row = Math.floor(b.y / CELL);
        b.x = b.col * CELL + CELL / 2;
        b.y = b.row * CELL + CELL / 2;
      } else {
        b.x = nextX;
        b.y = nextY;
        b.col = Math.floor(b.x / CELL);
        b.row = Math.floor(b.y / CELL);
      }
    }

    if (b.fuseTime <= 0) {
      explode(b);
      bombs.splice(i, 1);
    }
  }
}

function isSolidForBomb(c, r) {
  if (c<0 || c>=COLS || r<0 || r>=ROWS) return true;
  if (grid[r][c] === CELL_HARD || grid[r][c] === CELL_SOFT) return true;
  if (bombs.some(b => b.col === c && b.row === r && !b.kicked)) return true;
  return false;
}

function explode(bomb) {
  let p = players[bomb.ownerId];
  if (p) {
    p.activeBombs = Math.max(0, p.activeBombs - 1);
    updateHUD();
  }
  if (window.AUDIO) AUDIO.play('bm_explode');

  let cells = [{c: bomb.col, r: bomb.row}];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  
  for (let [dx, dy] of dirs) {
    for (let i=1; i<=bomb.fireRange; i++) {
      let c = bomb.col + dx*i;
      let r = bomb.row + dy*i;
      if (c<0 || c>=COLS || r<0 || r>=ROWS) break;
      
      cells.push({c,r});
      if (grid[r][c] === CELL_HARD) {
        cells.pop();
        break;
      }
      if (grid[r][c] === CELL_SOFT) {
        destroySoftBrick(c, r);
        break;
      }
      // Check chain reaction
      let hitBomb = bombs.find(b => b.col === c && b.row === r);
      if (hitBomb) {
        hitBomb.fuseTime = 0; // trigger next frame
        break;
      }
    }
  }

  explosions.push({ cells, time: 800, maxTime: 800 });

  // Kill players
  for (let p of players) {
    if (p.alive && cells.some(cell => cell.c === p.col && cell.r === p.row)) {
      killPlayer(p);
    }
  }
}

function destroySoftBrick(c, r) {
  grid[r][c] = CELL_EMPTY;
  if (Math.random() < 0.35) {
    const item = weightedRandom(ITEMS);
    groundItems.push({ col: c, row: r, ...item, animT: 0 });
  }
}

function updateExplosions(dt) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    let ex = explosions[i];
    ex.time -= dt;
    if (ex.time <= 0) explosions.splice(i, 1);
    else {
      // Continuous kill check
      for (let p of players) {
        if (p.alive && ex.cells.some(cell => cell.c === p.col && cell.r === p.row)) {
          killPlayer(p);
        }
      }
    }
  }
}

function killPlayer(p) {
  p.alive = false;
  if (window.AUDIO) AUDIO.play('bm_death');
  updateHUD();
}

function updateItems() {
  for (let p of players) {
    if (!p.alive) continue;
    for (let i = groundItems.length - 1; i >= 0; i--) {
      let item = groundItems[i];
      if (p.col === item.col && p.row === item.row) {
        item.apply(p);
        floatingTexts.push({ x: p.x, y: p.y, text: item.icon, time: 1000, dy: -1 });
        if (window.AUDIO) AUDIO.play('bm_item');
        groundItems.splice(i, 1);
        updateHUD();
      }
    }
  }
  for (let i of groundItems) i.animT += 0.05;
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.time -= dt;
    ft.y += ft.dy;
    if (ft.time <= 0) floatingTexts.splice(i, 1);
  }
}

function checkWinCondition() {
  if (matchOver) return;
  let alivePlayers = players.filter(p => p.alive);
  if (alivePlayers.length <= 1) {
    gameRunning = false;
    let winner = alivePlayers[0];
    if (winner) {
      winner.score++;
      updateHUD();
      if (winner.score >= targetWins) {
        matchOver = true;
        showVictory(`P${winner.id+1} WINS THE MATCH!`, winner.color);
        if (window.AUDIO) AUDIO.play('bm_win');
        return;
      } else {
        showOverlay(`P${winner.id+1} WINS ROUND ${currentRound}`);
      }
    } else {
      showOverlay(`DRAW!`);
    }
    
    currentRound++;
    setTimeout(() => {
      if (!matchOver) startBombermanGame(false);
    }, 3000);
  }
}

function showVictory(text, color) {
  const overlay = document.getElementById('bm-victory-overlay');
  overlay.style.display = 'flex';
  const h1 = document.getElementById('bm-victory-text');
  h1.textContent = text;
  h1.style.color = color;
}

function updateHUD() {
  for (let i=0; i<4; i++) {
    const p = players[i];
    if (p) {
      document.getElementById('bm-score-p'+(i+1)).textContent = p.score;
      document.getElementById('bm-bombs-p'+(i+1)).textContent = '💣'.repeat(p.maxBombs);
      document.getElementById('bm-fire-p'+(i+1)).textContent = '🔥'.repeat(Math.min(p.fireRange, 5));
      document.getElementById('bm-speed-p'+(i+1)).textContent = p.speedLevel <= 1 ? '🐢' : p.speedLevel === 2 ? '🐇' : '⚡';
      const card = document.getElementById('bm-card-p'+(i+1));
      if (card) {
        if (!p.alive) card.classList.add('dead');
        else card.classList.remove('dead');
      }
    }
  }
}

function updateAI(p, dt) {
  // Simple random walk AI for 0.5 effort
  if (Math.random() < 0.05) {
    const dirs = ['up','down','left','right'];
    let dir = dirs[Math.floor(Math.random()*dirs.length)];
    p.keys = { up:false, down:false, left:false, right:false, bomb:false, kick:false };
    p.keys[dir] = true;
  }
  if (Math.random() < 0.01) {
    p.keys.bomb = true;
  }
}

function render() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid
  for (let r=0; r<ROWS; r++) {
    for (let c=0; c<COLS; c++) {
      let x = c*CELL, y = r*CELL;
      if (grid[r][c] === CELL_HARD) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(x, y, CELL, CELL);
      } else if (grid[r][c] === CELL_SOFT) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x+2, y+2, CELL-4, CELL-4);
      }
    }
  }

  // Draw Items
  for (let item of groundItems) {
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let yOff = Math.sin(item.animT)*4;
    ctx.fillText(item.icon, item.col*CELL + CELL/2, item.row*CELL + CELL/2 + yOff);
  }

  // Draw Bombs
  for (let b of bombs) {
    let r = (CELL/2 - 4) + (Math.sin(b.fuseTime/100)*2);
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI*2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = players[b.ownerId] ? players[b.ownerId].color : '#fff';
    ctx.stroke();
    
    // fuse arc
    ctx.beginPath();
    ctx.arc(b.x, b.y, r-4, -Math.PI/2, -Math.PI/2 + (b.fuseTime/3000)*Math.PI*2);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  // Draw Explosions
  for (let ex of explosions) {
    ctx.fillStyle = `rgba(239, 68, 68, ${ex.time/ex.maxTime})`;
    for (let cell of ex.cells) {
      ctx.fillRect(cell.c*CELL, cell.r*CELL, CELL, CELL);
    }
  }

  // Draw Players
  for (let p of players) {
    if (!p.alive) continue;
    const pr = PLAYER_RADIUS;
    ctx.fillStyle = p.color;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(p.x - pr, p.y - pr, pr * 2, pr * 2, 6);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - pr, p.y - pr, pr * 2, pr * 2);
    }
    
    if (p.cursed) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(p.x - pr, p.y - pr, pr * 2, pr * 2, 6);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - pr, p.y - pr, pr * 2, pr * 2);
      }
      ctx.fillStyle = '#fff';
      ctx.font = '16px Arial';
      ctx.fillText('☠️', p.x, p.y);
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id+1}`, p.x, p.y);
    }
  }

  // Draw Floating Texts
  for (let ft of floatingTexts) {
    ctx.fillStyle = `rgba(255,255,255,${ft.time/1000})`;
    ctx.font = '20px Arial';
    ctx.fillText(ft.text, ft.x, ft.y);
  }

  // Draw Timer / HUD
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvas.width/2 - 40, 0, 80, 30);
  ctx.fillStyle = suddenDeathActive ? '#ef4444' : '#fff';
  ctx.font = '20px Arial';
  let secs = Math.max(0, Math.ceil(roundTimer/1000));
  ctx.fillText(`${Math.floor(secs/60)}:${(secs%60).toString().padStart(2,'0')}`, canvas.width/2, 15);
  
  if (suddenDeathActive && Math.floor(Date.now()/500)%2===0) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('SUDDEN DEATH', canvas.width/2, 50);
  }
}
