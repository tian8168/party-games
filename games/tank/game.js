// ==========================================================================
// 🎯 极限抛物线 (Worms Artillery) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'TANK';
window.GAME_RULES = {
  'TANK': {"title":"极限抛物线 规则","body":"<p><strong>弹道对轰：</strong>观察实时风向与风速，调节角度与力度发射炮弹！击毁敌方坦克夺取胜利！</p>"}
};

const STATE = {
  currentView: 'GAME',

      currentGame: 'TANK',
      gameMode: 'AI',
      tank: { p1Hp: 100, p2Hp: 100, wind: 0, tank1: { x: 60, y: 200, angle: 45, power: 60 }, tank2: { x: 420, y: 200, angle: 45, power: 60 }, terrain: [], bullet: null, animId: null }
    
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
  
      if (typeof initTankGame === 'function') initTankGame();
      resetTankMatch();
      requestAnimationFrame(() => {
        resizeTankCanvas();
      });
    
}

// --- 游戏专属引擎核心逻辑 ---
// 10. 极限抛物线弹道核心逻辑 (TANK)
    // ==========================================================================
    function initTankGame() {
      STATE.tank.p1Hp = 100;
      STATE.tank.p2Hp = 100;
      STATE.tank.bullet = null;
      STATE.turn = 1;
      resizeTankCanvas();
      generateTankTerrain();
      updateTankWind();
      updateTankAimHUD();
      renderTank();
    }

    function resizeTankCanvas() {
      const c = document.getElementById('tank-canvas');
      if (!c) return;
      const rect = c.parentElement ? c.parentElement.getBoundingClientRect() : null;
      c.width = (rect && rect.width > 50) ? rect.width : (c.offsetWidth || 480);
      c.height = 290;
    }

    function generateTankTerrain() {
      const c = document.getElementById('tank-canvas');
      const w = c.width;
      const h = c.height;
      STATE.tank.terrain = [];

      for (let x = 0; x < w; x++) {
        const y = h * 0.7 + Math.sin(x * 0.015) * 35 + Math.sin(x * 0.04) * 15;
        STATE.tank.terrain.push(y);
      }

      STATE.tank.tank1.x = 55;
      STATE.tank.tank1.y = STATE.tank.terrain[55] - 8;
      STATE.tank.tank2.x = w - 55;
      STATE.tank.tank2.y = STATE.tank.terrain[w - 55] - 8;
    }

    function updateTankWind() {
      STATE.tank.wind = (Math.random() * 8 - 4).toFixed(1);
      const badge = document.getElementById('tank-wind-badge');
      const dir = STATE.tank.wind > 0 ? '➡️' : '⬅️';
      badge.textContent = `💨 风向: ${dir} ${Math.abs(STATE.tank.wind)} m/s`;
    }

    function updateTankAimHUD() {
      const angle = document.getElementById('tank-angle-slider').value;
      const power = document.getElementById('tank-power-slider').value;
      document.getElementById('tank-angle-val').textContent = `${angle}°`;
      document.getElementById('tank-power-val').textContent = `${power}%`;

      if (STATE.turn === 1) {
        STATE.tank.tank1.angle = parseInt(angle);
        STATE.tank.tank1.power = parseInt(power);
      }
      renderTank();
    }

    function fireTankPlayer() {
      if (STATE.turn !== 1 || STATE.tank.bullet) return;
      const t1 = STATE.tank.tank1;
      fireTankBullet(t1.x, t1.y - 6, t1.angle, t1.power, 1);
    }

    function fireTankBullet(startX, startY, angleDeg, powerVal, shooter) {
      AUDIO.play('tank_fire');
      const rad = (angleDeg * Math.PI) / 180;
      const speed = powerVal * 0.18;
      const vx = Math.cos(rad) * speed * (shooter === 1 ? 1 : -1);
      const vy = -Math.sin(rad) * speed;

      STATE.tank.bullet = {
        x: startX,
        y: startY,
        vx: vx,
        vy: vy,
        trail: [],
        shooter: shooter
      };

      startTankBulletLoop();
    }

    function startTankBulletLoop() {
      if (STATE.tank.animId) cancelAnimationFrame(STATE.tank.animId);

      let lastTime = performance.now();
      let accumulator = 0;
      const FIXED_STEP = 1000 / 60;

      function step(now) {
        if (!STATE.tank.bullet || STATE.currentGame !== 'TANK') return;
        if (!now) now = performance.now();
        let elapsed = now - lastTime;
        lastTime = now;
        if (elapsed > 100) elapsed = 100;
        accumulator += elapsed;

        const c = document.getElementById('tank-canvas');

        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          const b = STATE.tank.bullet;
          if (!b) break;

          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 25) b.trail.shift();

          b.vx += parseFloat(STATE.tank.wind) * 0.012;
          b.vy += 0.28;
          b.x += b.vx;
          b.y += b.vy;

          const xInt = Math.floor(b.x);
          if (b.x < 0 || b.x >= c.width || b.y > c.height + 20) {
            explodeTankShell(b.x, b.y, false);
            return;
          }

          if (xInt >= 0 && xInt < c.width && b.y >= STATE.tank.terrain[xInt]) {
            explodeTankShell(b.x, b.y, true);
            return;
          }
        }

        renderTank();
        if (STATE.tank.bullet) {
          STATE.tank.animId = requestAnimationFrame(step);
        }
      }

      STATE.tank.animId = requestAnimationFrame(step);
    }

    function explodeTankShell(bx, by, carve) {
      STATE.tank.bullet = null;
      AUDIO.play('tank_explosion');

      const c = document.getElementById('tank-canvas');
      const blastR = 24;

      if (carve) {
        for (let x = Math.max(0, Math.floor(bx - blastR)); x < Math.min(c.width, Math.ceil(bx + blastR)); x++) {
          const dx = x - bx;
          const dyMax = Math.sqrt(blastR * blastR - dx * dx);
          if (STATE.tank.terrain[x] < by + dyMax) {
            STATE.tank.terrain[x] = Math.min(c.height - 10, by + dyMax);
          }
        }
        STATE.tank.tank1.y = STATE.tank.terrain[Math.floor(STATE.tank.tank1.x)] - 8;
        STATE.tank.tank2.y = STATE.tank.terrain[Math.floor(STATE.tank.tank2.x)] - 8;
      }

      const d1 = Math.hypot(bx - STATE.tank.tank1.x, by - STATE.tank.tank1.y);
      const d2 = Math.hypot(bx - STATE.tank.tank2.x, by - STATE.tank.tank2.y);

      if (d1 < 36) {
        const dmg = Math.round(55 * (1 - d1 / 36));
        STATE.tank.p1Hp = Math.max(0, STATE.tank.p1Hp - dmg);
      }
      if (d2 < 36) {
        const dmg = Math.round(55 * (1 - d2 / 36));
        STATE.tank.p2Hp = Math.max(0, STATE.tank.p2Hp - dmg);
      }

      document.getElementById('tank-hp-p1').style.width = `${STATE.tank.p1Hp}%`;
      document.getElementById('tank-hp-p2').style.width = `${STATE.tank.p2Hp}%`;

      renderTank();

      if (STATE.tank.p1Hp <= 0 || STATE.tank.p2Hp <= 0) {
        setTimeout(() => {
          showModal('坦克大战 战报', STATE.tank.p1Hp > 0 ? '🏆 神级高抛！你成功轰平了对方的防御！' : '💀 战车装甲破损，敌方炮火更胜一筹！');
        }, 1000);
      } else {
        STATE.turn = STATE.turn === 1 ? 2 : 1;
        updateTankWind();
        if (STATE.turn === 2 && STATE.gameMode === 'AI') {
          setTimeout(runTankAI, 1400);
        }
      }
    }

    function runTankAI() {
      if (STATE.turn !== 2 || STATE.tank.bullet) return;
      const t2 = STATE.tank.tank2;
      const t1 = STATE.tank.tank1;

      const dx = t2.x - t1.x;
      const baseAngle = 45 + Math.random() * 15;
      const basePower = Math.min(95, Math.max(40, (dx * 0.17) - parseFloat(STATE.tank.wind) * 2.5 + (Math.random() * 8 - 4)));

      fireTankBullet(t2.x, t2.y - 6, baseAngle, basePower, 2);
    }

    function renderTank() {
      const c = document.getElementById('tank-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, c.height);
      skyGrad.addColorStop(0, '#0b1329');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, c.width, c.height);

      if (STATE.tank.terrain.length > 0) {
        ctx.beginPath();
        ctx.moveTo(0, c.height);
        for (let x = 0; x < c.width; x++) {
          ctx.lineTo(x, STATE.tank.terrain[x]);
        }
        ctx.lineTo(c.width, c.height);
        ctx.closePath();
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#22c55e';
        ctx.stroke();
      }

      const t1 = STATE.tank.tank1;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(t1.x - 12, t1.y - 6, 24, 12);
      const rad1 = (t1.angle * Math.PI) / 180;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(t1.x, t1.y - 2);
      ctx.lineTo(t1.x + Math.cos(rad1) * 16, t1.y - 2 - Math.sin(rad1) * 16);
      ctx.stroke();

      const t2 = STATE.tank.tank2;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(t2.x - 12, t2.y - 6, 24, 12);
      const rad2 = (t2.angle * Math.PI) / 180;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(t2.x, t2.y - 2);
      ctx.lineTo(t2.x - Math.cos(rad2) * 16, t2.y - 2 - Math.sin(rad2) * 16);
      ctx.stroke();

      if (STATE.tank.bullet) {
        const b = STATE.tank.bullet;
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        b.trail.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
      }
    }

    function resetTankMatch() {
      initTankGame();
    }

    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('TANK');
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
