// ==========================================================================
// 🚗 物理飞车相扑 (Sumo Cars) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'SUMO';
window.GAME_RULES = {
  'SUMO': {"title":"🚗 物理飞车相扑 规则","body":"<p><strong>极限推土机：</strong>按住【冲刺】推撞对手，松开自动转弯瞄准！将对手顶出悬浮擂台边缘得分，抢先 <b>3 分</b> 夺冠！</p>"}
};

const STATE = {
  currentView: 'GAME',

      currentGame: 'SUMO',
      gameMode: 'AI',
      sumo: { p1Score: 0, p2Score: 0, targetScore: 3, car1: { x: 130, y: 180, vx: 0, vy: 0, angle: 0, r: 17, boosting: false, falling: false, fallScale: 1, fallAlpha: 1, fallSpin: 0 }, car2: { x: 230, y: 180, vx: 0, vy: 0, angle: Math.PI, r: 17, boosting: false, falling: false, fallScale: 1, fallAlpha: 1, fallSpin: 0 }, arenaRadius: 130, particles: [], animId: null, roundOver: false, matchOver: false, aiReactionDelay: 0 }
    
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
  
      if (typeof initSumoGame === 'function') initSumoGame();
      resetSumoMatch();
      requestAnimationFrame(() => {
        resizeSumoCanvas();
        renderSumo();
      });
    
}

// --- 游戏专属引擎核心逻辑 ---
// 9. 物理飞车相扑核心逻辑 (SUMO)
    // ==========================================================================
    let sumoInputBound = false;

    function initSumoGame() {
      STATE.sumo.p1Score = 0;
      STATE.sumo.p2Score = 0;
      STATE.sumo.roundOver = false;
      STATE.sumo.matchOver = false;

      const isLocal = STATE.gameMode === 'LOCAL';
      const p1ScoreEl = document.getElementById('sumo-p1-score');
      const p2ScoreEl = document.getElementById('sumo-p2-score');
      const hintEl = document.getElementById('sumo-touch-hint');
      const btnP1 = document.getElementById('btn-sumo-boost');
      const btnP2 = document.getElementById('btn-sumo-boost-p2');

      if (p1ScoreEl) p1ScoreEl.textContent = `${isLocal ? '🔴 玩家1' : '🔴 玩家'}: 0`;
      if (p2ScoreEl) p2ScoreEl.textContent = `${isLocal ? '🔵 玩家2' : '🔵 电脑'}: 0`;
      if (hintEl) {
        hintEl.textContent = isLocal
          ? '💡 触屏左/P1冲刺 · 触屏右/P2冲刺 (松开自动转向)'
          : '💡 触碰屏幕或下方按键冲刺 (松开自动转向瞄准)';
      }
      if (btnP1) {
        btnP1.textContent = isLocal ? '🚀 P1 冲刺 [A/W/空格]' : '🚀 按住冲刺 [空格/W/↑]';
      }
      if (btnP2) {
        btnP2.style.display = isLocal ? 'flex' : 'none';
        btnP2.textContent = '🚀 P2 冲刺 [L/回车/↑]';
      }

      resizeSumoCanvas();
      resetSumoRound();
      startSumoLoop();

      if (!sumoInputBound) {
        sumoInputBound = true;
        bindSumoInputEvents();
      }
    }

    function setSumoBoostP1(b) {
      if (STATE.sumo.car1 && !STATE.sumo.car1.falling) STATE.sumo.car1.boosting = b;
      const btn = document.getElementById('btn-sumo-boost');
      if (btn) btn.classList.toggle('boosting', b);
    }

    function setSumoBoostP2(b) {
      if (STATE.sumo.car2 && !STATE.sumo.car2.falling) STATE.sumo.car2.boosting = b;
      const btn = document.getElementById('btn-sumo-boost-p2');
      if (btn) btn.classList.toggle('boosting', b);
    }

    function bindSumoInputEvents() {
      const btnP1 = document.getElementById('btn-sumo-boost');
      const btnP2 = document.getElementById('btn-sumo-boost-p2');
      const canvas = document.getElementById('sumo-canvas');

      const bindBtn = (el, setFn) => {
        if (!el) return;
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); setFn(true); });
        el.addEventListener('pointerup', (e) => { e.preventDefault(); setFn(false); });
        el.addEventListener('pointercancel', (e) => { e.preventDefault(); setFn(false); });
        el.addEventListener('pointerleave', (e) => { e.preventDefault(); setFn(false); });
      };

      bindBtn(btnP1, setSumoBoostP1);
      bindBtn(btnP2, setSumoBoostP2);

      if (canvas) {
        canvas.addEventListener('pointerdown', (e) => {
          if (STATE.currentGame !== 'SUMO') return;
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const touchX = e.clientX - rect.left;
          if (STATE.gameMode === 'LOCAL') {
            if (touchX < rect.width / 2) {
              setSumoBoostP1(true);
            } else {
              setSumoBoostP2(true);
            }
          } else {
            setSumoBoostP1(true);
          }
        });

        const cancelCanvasBoost = (e) => {
          if (STATE.currentGame !== 'SUMO') return;
          e.preventDefault();
          setSumoBoostP1(false);
          setSumoBoostP2(false);
        };
        canvas.addEventListener('pointerup', cancelCanvasBoost);
        canvas.addEventListener('pointercancel', cancelCanvasBoost);
        canvas.addEventListener('pointerleave', cancelCanvasBoost);
      }

      window.addEventListener('keydown', (e) => {
        if (STATE.currentGame !== 'SUMO') return;
        if (['Space', 'KeyW', 'ArrowUp', 'KeyA', 'KeyS', 'KeyD', 'KeyL', 'Enter', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        if (STATE.gameMode === 'LOCAL') {
          if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) setSumoBoostP1(true);
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'KeyL'].includes(e.code)) setSumoBoostP2(true);
        } else {
          if (['Space', 'KeyW', 'ArrowUp', 'KeyJ', 'Enter'].includes(e.code)) setSumoBoostP1(true);
        }
      });

      window.addEventListener('keyup', (e) => {
        if (STATE.currentGame !== 'SUMO') return;
        if (STATE.gameMode === 'LOCAL') {
          if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) setSumoBoostP1(false);
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'KeyL'].includes(e.code)) setSumoBoostP2(false);
        } else {
          if (['Space', 'KeyW', 'ArrowUp', 'KeyJ', 'Enter'].includes(e.code)) setSumoBoostP1(false);
        }
      });
    }

    function resizeSumoCanvas() {
      const c = document.getElementById('sumo-canvas');
      if (!c) return;
      const rect = c.parentElement ? c.parentElement.getBoundingClientRect() : null;
      const w = (rect && rect.width > 50) ? Math.floor(rect.width) : (c.offsetWidth || 340);
      const h = (rect && rect.height > 50) ? Math.floor(rect.height) : (c.offsetHeight || 340);
      c.width = w;
      c.height = h;
      STATE.sumo.arenaRadius = Math.min(w, h) * 0.38;
    }

    function resetSumoRound() {
      const c = document.getElementById('sumo-canvas');
      if (!c) return;
      const cx = c.width / 2;
      const cy = c.height / 2 - 12;
      const R = STATE.sumo.arenaRadius || 130;
      const offset = Math.min(65, R * 0.5);

      STATE.sumo.car1 = {
        x: cx - offset,
        y: cy,
        vx: 0,
        vy: 0,
        angle: 0,
        r: 17,
        boosting: false,
        falling: false,
        fallScale: 1,
        fallAlpha: 1,
        fallSpin: 0
      };

      STATE.sumo.car2 = {
        x: cx + offset,
        y: cy,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        r: 17,
        boosting: false,
        falling: false,
        fallScale: 1,
        fallAlpha: 1,
        fallSpin: 0
      };

      STATE.sumo.particles = [];
      STATE.sumo.roundOver = false;
      STATE.sumo.aiReactionDelay = 25;

      const isLocal = STATE.gameMode === 'LOCAL';
      const p1ScoreEl = document.getElementById('sumo-p1-score');
      const p2ScoreEl = document.getElementById('sumo-p2-score');
      if (p1ScoreEl) p1ScoreEl.textContent = `${isLocal ? '🔴 玩家1' : '🔴 玩家'}: ${STATE.sumo.p1Score}`;
      if (p2ScoreEl) p2ScoreEl.textContent = `${isLocal ? '🔵 玩家2' : '🔵 电脑'}: ${STATE.sumo.p2Score}`;
    }

    function startSumoLoop() {
      if (STATE.sumo.animId) cancelAnimationFrame(STATE.sumo.animId);

      let lastTime = performance.now();
      let accumulator = 0;
      const FIXED_STEP = 1000 / 60;

      function loop(now) {
        if (STATE.currentGame === 'SUMO') {
          if (!now) now = performance.now();
          let elapsed = now - lastTime;
          lastTime = now;
          if (elapsed > 100) elapsed = 100;
          accumulator += elapsed;

          while (accumulator >= FIXED_STEP) {
            updateSumoPhysics();
            accumulator -= FIXED_STEP;
          }

          renderSumo();
          STATE.sumo.animId = requestAnimationFrame(loop);
        }
      }
      loop(performance.now());
    }

    function updateSumoPhysics() {
      const c1 = STATE.sumo.car1;
      const c2 = STATE.sumo.car2;
      if (!c1 || !c2) return;

      const c = document.getElementById('sumo-canvas');
      if (!c) return;
      const cx = c.width / 2;
      const cy = c.height / 2 - 12;
      const R = STATE.sumo.arenaRadius || 130;

      // When round is ending (someone falling)
      if (STATE.sumo.roundOver) {
        [c1, c2].forEach(car => {
          if (car.falling) {
            car.x += car.vx * 0.45;
            car.y += car.vy * 0.45;
            car.fallScale = Math.max(0, car.fallScale - 0.035);
            car.fallAlpha = Math.max(0, car.fallAlpha - 0.035);
            car.fallSpin += 0.25;
          } else {
            car.vx *= 0.92;
            car.vy *= 0.92;
            car.x += car.vx;
            car.y += car.vy;
          }
        });
        STATE.sumo.particles.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        });
        STATE.sumo.particles = STATE.sumo.particles.filter(p => p.life > 0);
        return;
      }

      const wrapAngle = (a) => {
        while (a < -Math.PI) a += Math.PI * 2;
        while (a > Math.PI) a -= Math.PI * 2;
        return a;
      };

      // Car 1 (Red)
      if (c1.boosting) {
        c1.vx += Math.cos(c1.angle) * 0.48;
        c1.vy += Math.sin(c1.angle) * 0.48;
        if (Math.random() < 0.75) {
          STATE.sumo.particles.push({
            x: c1.x - Math.cos(c1.angle) * (c1.r + 2),
            y: c1.y - Math.sin(c1.angle) * (c1.r + 2),
            vx: -Math.cos(c1.angle) * 2.5 + (Math.random() - 0.5) * 2,
            vy: -Math.sin(c1.angle) * 2.5 + (Math.random() - 0.5) * 2,
            life: 0.65,
            color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
            size: 3
          });
        }
      } else {
        const targetAngle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
        const diff = wrapAngle(targetAngle - c1.angle);
        c1.angle += diff * 0.09;
      }

      // Car 2 (Blue)
      if (STATE.gameMode === 'LOCAL') {
        if (c2.boosting) {
          c2.vx += Math.cos(c2.angle) * 0.48;
          c2.vy += Math.sin(c2.angle) * 0.48;
          if (Math.random() < 0.75) {
            STATE.sumo.particles.push({
              x: c2.x - Math.cos(c2.angle) * (c2.r + 2),
              y: c2.y - Math.sin(c2.angle) * (c2.r + 2),
              vx: -Math.cos(c2.angle) * 2.5 + (Math.random() - 0.5) * 2,
              vy: -Math.sin(c2.angle) * 2.5 + (Math.random() - 0.5) * 2,
              life: 0.65,
              color: Math.random() > 0.5 ? '#38bdf8' : '#3b82f6',
              size: 3
            });
          }
        } else {
          const targetAngle = Math.atan2(c1.y - c2.y, c1.x - c2.x);
          const diff = wrapAngle(targetAngle - c2.angle);
          c2.angle += diff * 0.09;
        }
      } else {
        // AI Car 2
        const p2TargetAngle = Math.atan2(c1.y - c2.y, c1.x - c2.x);
        const p2Diff = wrapAngle(p2TargetAngle - c2.angle);
        c2.angle += p2Diff * 0.085;

        if (STATE.sumo.aiReactionDelay > 0) {
          STATE.sumo.aiReactionDelay--;
          c2.boosting = false;
        } else {
          const distToP1 = Math.hypot(c1.x - c2.x, c1.y - c2.y);
          if (distToP1 < R * 1.5 && Math.abs(p2Diff) < 0.7) {
            c2.boosting = true;
            c2.vx += Math.cos(c2.angle) * 0.42;
            c2.vy += Math.sin(c2.angle) * 0.42;
            if (Math.random() < 0.6) {
              STATE.sumo.particles.push({
                x: c2.x - Math.cos(c2.angle) * (c2.r + 2),
                y: c2.y - Math.sin(c2.angle) * (c2.r + 2),
                vx: -Math.cos(c2.angle) * 2.5 + (Math.random() - 0.5) * 2,
                vy: -Math.sin(c2.angle) * 2.5 + (Math.random() - 0.5) * 2,
                life: 0.65,
                color: '#38bdf8',
                size: 3
              });
            }
          } else {
            c2.boosting = false;
          }
        }
      }

      // Drag and speed limit
      [c1, c2].forEach(car => {
        car.vx *= 0.95;
        car.vy *= 0.95;
        const spd = Math.hypot(car.vx, car.vy);
        if (spd > 8.0) {
          car.vx = (car.vx / spd) * 8.0;
          car.vy = (car.vy / spd) * 8.0;
        }
        car.x += car.vx;
        car.y += car.vy;
      });

      // Rigid collision response
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = c1.r + c2.r;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;

        c1.x -= nx * overlap * 0.52;
        c1.y -= ny * overlap * 0.52;
        c2.x += nx * overlap * 0.52;
        c2.y += ny * overlap * 0.52;

        const relVel = (c1.vx - c2.vx) * nx + (c1.vy - c2.vy) * ny;
        if (relVel > 0) {
          const restitution = 1.45;
          const impulse = (1 + restitution) * relVel * 0.5;
          c1.vx -= nx * impulse;
          c1.vy -= ny * impulse;
          c2.vx += nx * impulse;
          c2.vy += ny * impulse;

          AUDIO.play('bonk');

          for (let i = 0; i < 10; i++) {
            STATE.sumo.particles.push({
              x: (c1.x + c2.x) / 2,
              y: (c1.y + c2.y) / 2,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 0.9,
              color: Math.random() > 0.5 ? '#f59e0b' : '#ffffff',
              size: Math.random() * 3 + 2
            });
          }
        }
      }

      // Edge check
      const d1 = Math.hypot(c1.x - cx, c1.y - cy);
      const d2 = Math.hypot(c2.x - cx, c2.y - cy);
      const fallThreshold = R + 8;

      if (d1 > fallThreshold || d2 > fallThreshold) {
        STATE.sumo.roundOver = true;
        AUDIO.play('fall');

        if (d1 > fallThreshold && d2 > fallThreshold) {
          if (d1 > d2) {
            c1.falling = true;
            STATE.sumo.p2Score++;
          } else {
            c2.falling = true;
            STATE.sumo.p1Score++;
          }
        } else if (d1 > fallThreshold) {
          c1.falling = true;
          STATE.sumo.p2Score++;
        } else {
          c2.falling = true;
          STATE.sumo.p1Score++;
        }

        setTimeout(checkSumoMatchEnd, 1100);
      }

      // Particles update
      STATE.sumo.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
      });
      STATE.sumo.particles = STATE.sumo.particles.filter(p => p.life > 0);
    }

    function checkSumoMatchEnd() {
      const isLocal = STATE.gameMode === 'LOCAL';
      const p1ScoreEl = document.getElementById('sumo-p1-score');
      const p2ScoreEl = document.getElementById('sumo-p2-score');
      if (p1ScoreEl) p1ScoreEl.textContent = `${isLocal ? '🔴 玩家1' : '🔴 玩家'}: ${STATE.sumo.p1Score}`;
      if (p2ScoreEl) p2ScoreEl.textContent = `${isLocal ? '🔵 玩家2' : '🔵 电脑'}: ${STATE.sumo.p2Score}`;

      if (STATE.sumo.p1Score >= STATE.sumo.targetScore || STATE.sumo.p2Score >= STATE.sumo.targetScore) {
        const isP1 = STATE.sumo.p1Score >= STATE.sumo.targetScore;
        STATE.sumo.matchOver = true;
        const msg = isLocal
          ? (isP1 ? '🏆 🔴 玩家1 凭借狂暴冲撞夺得相扑总冠军！' : '🏆 🔵 玩家2 凭借绝妙漂移夺得相扑总冠军！')
          : (isP1 ? '🏆 猛烈推撞！你把对手彻底轰下了擂台，夺得冠军！' : '💀 遗憾跌落深渊，对手获胜！');

        showModal('相扑擂台 战报', msg);

        STATE.sumo.p1Score = 0;
        STATE.sumo.p2Score = 0;
        resetSumoRound();
      } else {
        resetSumoRound();
      }
    }

    function renderSumo() {
      const c = document.getElementById('sumo-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const cx = c.width / 2;
      const cy = c.height / 2 - 12;
      const R = STATE.sumo.arenaRadius || 130;

      ctx.clearRect(0, 0, c.width, c.height);

      // 1. Arena Abyss Drop-off
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fill();

      // Hazard dashed ring
      ctx.beginPath();
      ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      if (ctx.setLineDash) ctx.setLineDash([6, 6]);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);

      // Main Arena Ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const ringGrad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      ringGrad.addColorStop(0, '#1e293b');
      ringGrad.addColorStop(0.85, '#0f172a');
      ringGrad.addColorStop(1, '#020617');
      ctx.fillStyle = ringGrad;
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Center crosshair and inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy); ctx.lineTo(cx + 24, cy);
      ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy + 24);
      ctx.stroke();
      ctx.restore();

      // 2. Particles
      STATE.sumo.particles.forEach(p => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size || 3) * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fill();
        ctx.restore();
      });

      // 3. Cars
      const cars = [STATE.sumo.car1, STATE.sumo.car2];
      cars.forEach((car, idx) => {
        if (!car) return;
        const isP1 = idx === 0;
        ctx.save();
        ctx.translate(car.x, car.y);

        if (car.falling) {
          ctx.scale(car.fallScale, car.fallScale);
          ctx.rotate(car.angle + car.fallSpin);
          ctx.globalAlpha = car.fallAlpha;
        } else {
          ctx.rotate(car.angle);
        }

        // Car Shadow
        ctx.beginPath();
        ctx.arc(2, 3, car.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();

        // Wheels (4 small rounded rectangles)
        ctx.fillStyle = '#334155';
        ctx.fillRect(-car.r * 0.7, -car.r - 2, car.r * 0.5, 4);
        ctx.fillRect(car.r * 0.2, -car.r - 2, car.r * 0.5, 4);
        ctx.fillRect(-car.r * 0.7, car.r - 2, car.r * 0.5, 4);
        ctx.fillRect(car.r * 0.2, car.r - 2, car.r * 0.5, 4);

        // Heavy Front Bumper (Push Guard)
        ctx.beginPath();
        ctx.arc(car.r * 0.5, 0, car.r * 0.9, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();

        // Main Car Body
        ctx.beginPath();
        ctx.arc(0, 0, car.r, 0, Math.PI * 2);
        const carGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, car.r);
        if (isP1) {
          carGrad.addColorStop(0, '#f87171');
          carGrad.addColorStop(1, '#dc2626');
        } else {
          carGrad.addColorStop(0, '#60a5fa');
          carGrad.addColorStop(1, '#2563eb');
        }
        ctx.fillStyle = carGrad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Cockpit / Windshield
        ctx.beginPath();
        ctx.arc(car.r * 0.15, 0, car.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(car.r * 0.75, -car.r * 0.4, 2.5, 0, Math.PI * 2);
        ctx.arc(car.r * 0.75, car.r * 0.4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    function resetSumoMatch() {
      initSumoGame();
    }

    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('SUMO');
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
