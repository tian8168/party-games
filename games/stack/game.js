// ==========================================================================
// 🧱 极光叠叠高 (Stacker Towers) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'STACK';
window.GAME_RULES = {
  'STACK': {"title":"极光叠叠高 规则","body":"<p><strong>节奏切割：</strong>轻触屏幕让横飞的方块落下。对齐严丝合缝触发 PERFECT 连击！多余边缘会被一刀切掉！</p>"}
};

const STATE = {
  currentView: 'GAME',

      currentGame: 'STACK',
      gameMode: 'LOCAL',
      stack: { score: 0, combo: 0, layers: [], current: null, falling: [], animId: null, over: false }
    
};
window.STATE = STATE;

function checkIsMyTurn() {
  if (STATE.gameMode === 'LOCAL') return true;
  if (STATE.gameMode === 'AI') return STATE.turn === 1;
  if (STATE.gameMode === 'ONLINE') {
    if (!STATE.online.opponentJoined) return false;
    if (STATE.online.myRole === 'host' && STATE.turn === 1) return true;
    if (STATE.online.myRole === 'guest' && STATE.turn === 2) return true;
    return false;
  }
  return false;
}

function switchGameMode(mode, doReset = true) {
  if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('click');
  STATE.gameMode = mode;
  const tabOnline = document.getElementById('tab-online');
  const tabAi = document.getElementById('tab-ai');
  const tabLocal = document.getElementById('tab-local');
  const onlinePanel = document.getElementById('online-panel');
  if (tabOnline) tabOnline.classList.toggle('active', mode === 'ONLINE');
  if (tabAi) tabAi.classList.toggle('active', mode === 'AI');
  if (tabLocal) tabLocal.classList.toggle('active', mode === 'LOCAL');
  if (onlinePanel) onlinePanel.classList.toggle('hidden', mode !== 'ONLINE');

  if (doReset) {
    resetCurrentGame();
  }
}

function resetCurrentGame() {
  
      if (typeof initStackGame === 'function') initStackGame();
      resetStackMatch();
      requestAnimationFrame(() => {
        resizeStackCanvas();
      });
    
}

// --- 游戏专属引擎核心逻辑 ---
// 11. 极光叠叠高核心逻辑 (STACK)
    // ==========================================================================
    function initStackGame() {
      STATE.stack.score = 0;
      STATE.stack.combo = 0;
      STATE.stack.over = false;
      STATE.stack.layers = [];
      STATE.stack.falling = [];

      resizeStackCanvas();

      STATE.stack.layers.push({
        x: 0,
        z: 0,
        w: 150,
        d: 150,
        h: 16,
        hue: 190
      });

      spawnNextStackLayer();
      startStackLoop();
      updateStackHUD();
    }

    function resizeStackCanvas() {
      const c = document.getElementById('stack-canvas');
      if (!c) return;
      const rect = c.parentElement ? c.parentElement.getBoundingClientRect() : null;
      c.width = (rect && rect.width > 50) ? rect.width : (c.offsetWidth || 360);
      c.height = (rect && rect.height > 50) ? rect.height : (c.offsetHeight || 440);
    }

    function updateStackHUD() {
      document.getElementById('stack-score').textContent = STATE.stack.score;
      const comboBadge = document.getElementById('stack-combo');
      if (STATE.stack.combo > 1) {
        comboBadge.style.display = 'block';
        comboBadge.textContent = `PERFECT x${STATE.stack.combo}`;
      } else {
        comboBadge.style.display = 'none';
      }
    }

    function spawnNextStackLayer() {
      const top = STATE.stack.layers[STATE.stack.layers.length - 1];
      const axis = STATE.stack.layers.length % 2 === 0 ? 'x' : 'z';
      const hue = (STATE.stack.layers.length * 14) % 360;

      STATE.stack.current = {
        x: axis === 'x' ? -180 : top.x,
        z: axis === 'z' ? -180 : top.z,
        w: top.w,
        d: top.d,
        h: 16,
        axis: axis,
        dir: 1,
        speed: 2.4 + Math.min(2.5, STATE.stack.score * 0.05),
        hue: hue
      };
    }

    function handleStackDrop() {
      AUDIO.init();
      if (STATE.stack.over || !STATE.stack.current) {
        if (STATE.stack.over) resetStackMatch();
        return;
      }

      const cur = STATE.stack.current;
      const top = STATE.stack.layers[STATE.stack.layers.length - 1];
      const axis = cur.axis;

      const delta = axis === 'x' ? cur.x - top.x : cur.z - top.z;
      const size = axis === 'x' ? cur.w : cur.d;

      if (Math.abs(delta) < 3.5) {
        if (axis === 'x') cur.x = top.x;
        else cur.z = top.z;

        STATE.stack.combo++;
        AUDIO.play('perfect', STATE.stack.combo);
      } else if (Math.abs(delta) < size) {
        const overlap = size - Math.abs(delta);
        const sliceSize = Math.abs(delta);

        STATE.stack.falling.push({
          x: axis === 'x' ? (delta > 0 ? top.x + overlap : cur.x) : cur.x,
          z: axis === 'z' ? (delta > 0 ? top.z + overlap : cur.z) : cur.z,
          w: axis === 'x' ? sliceSize : cur.w,
          d: axis === 'z' ? sliceSize : cur.d,
          h: 16,
          y: STATE.stack.layers.length * 16,
          vy: 0,
          hue: cur.hue
        });

        if (axis === 'x') {
          cur.w = overlap;
          cur.x = delta > 0 ? top.x : top.x - (size - overlap);
        } else {
          cur.d = overlap;
          cur.z = delta > 0 ? top.z : top.z - (size - overlap);
        }

        STATE.stack.combo = 0;
        AUDIO.play('slice');
      } else {
        STATE.stack.over = true;
        STATE.stack.falling.push({
          x: cur.x, z: cur.z, w: cur.w, d: cur.d, h: 16,
          y: STATE.stack.layers.length * 16, vy: 0, hue: cur.hue
        });
        STATE.stack.current = null;
        AUDIO.play('fall');
        setTimeout(() => {
          showModal('极光叠叠高 结算', `<h3>🏛️ 建造总层数: ${STATE.stack.score}</h3><br><p>节奏感极佳！点击任意位置可重新挑战更高摩天大厦！</p>`);
        }, 800);
        return;
      }

      STATE.stack.layers.push({
        x: cur.x,
        z: cur.z,
        w: cur.w,
        d: cur.d,
        h: 16,
        hue: cur.hue
      });

      STATE.stack.score++;
      updateStackHUD();
      spawnNextStackLayer();
    }

    function startStackLoop() {
      if (STATE.stack.animId) cancelAnimationFrame(STATE.stack.animId);

      let lastTime = performance.now();
      let accumulator = 0;
      const FIXED_STEP = 1000 / 60;

      function loop(now) {
        if (STATE.currentGame === 'STACK') {
          if (!now) now = performance.now();
          let elapsed = now - lastTime;
          lastTime = now;
          if (elapsed > 100) elapsed = 100;
          accumulator += elapsed;

          while (accumulator >= FIXED_STEP) {
            updateStackAnim();
            accumulator -= FIXED_STEP;
          }

          renderStack();
          STATE.stack.animId = requestAnimationFrame(loop);
        }
      }
      loop(performance.now());
    }

    function updateStackAnim() {
      const cur = STATE.stack.current;
      if (cur) {
        if (cur.axis === 'x') {
          cur.x += cur.speed * cur.dir;
          if (cur.x > 180) { cur.x = 180; cur.dir = -1; }
          else if (cur.x < -180) { cur.x = -180; cur.dir = 1; }
        } else {
          cur.z += cur.speed * cur.dir;
          if (cur.z > 180) { cur.z = 180; cur.dir = -1; }
          else if (cur.z < -180) { cur.z = -180; cur.dir = 1; }
        }
      }

      STATE.stack.falling.forEach(f => {
        f.vy += 0.8;
        f.y -= f.vy;
      });
      STATE.stack.falling = STATE.stack.falling.filter(f => f.y > -200);
    }

    function renderStack() {
      const c = document.getElementById('stack-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);

      const cx = c.width / 2;
      const cy = c.height * 0.72;
      const camY = Math.max(0, (STATE.stack.layers.length - 4) * 16);

      function toIso(x, z, y) {
        return {
          px: cx + (x - z) * 0.866,
          py: cy + (x + z) * 0.5 - (y - camY)
        };
      }

      function drawIsoBlock(block, yLevel) {
        const p1 = toIso(block.x - block.w / 2, block.z - block.d / 2, yLevel);
        const p2 = toIso(block.x + block.w / 2, block.z - block.d / 2, yLevel);
        const p3 = toIso(block.x + block.w / 2, block.z + block.d / 2, yLevel);
        const p4 = toIso(block.x - block.w / 2, block.z + block.d / 2, yLevel);

        const h = block.h;

        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py); ctx.lineTo(p2.px, p2.py);
        ctx.lineTo(p3.px, p3.py); ctx.lineTo(p4.px, p4.py);
        ctx.closePath();
        ctx.fillStyle = `hsl(${block.hue}, 85%, 65%)`;
        ctx.fill();
        ctx.strokeStyle = `hsl(${block.hue}, 90%, 75%)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(p2.px, p2.py); ctx.lineTo(p3.px, p3.py);
        ctx.lineTo(p3.px, p3.py + h); ctx.lineTo(p2.px, p2.py + h);
        ctx.closePath();
        ctx.fillStyle = `hsl(${block.hue}, 80%, 45%)`;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p3.px, p3.py); ctx.lineTo(p4.px, p4.py);
        ctx.lineTo(p4.px, p4.py + h); ctx.lineTo(p3.px, p3.py + h);
        ctx.closePath();
        ctx.fillStyle = `hsl(${block.hue}, 75%, 35%)`;
        ctx.fill();
      }

      STATE.stack.layers.forEach((l, idx) => {
        drawIsoBlock(l, idx * 16);
      });

      STATE.stack.falling.forEach(f => {
        drawIsoBlock(f, f.y);
      });

      if (STATE.stack.current) {
        drawIsoBlock(STATE.stack.current, STATE.stack.layers.length * 16);
      }
    }

    function resetStackMatch() {
      initStackGame();
    }

    
    // ==========================================================================
    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('STACK');
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
