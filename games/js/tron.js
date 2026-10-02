/**
 * 🏍️ 极光光轮摩托 (Tron Light Cycles 4P)
 * 纯原生 Canvas 2D 霓虹发光管线 · 60FPS 运动平滑与碰撞检测 · 1~4 人模式 · 智能 Flood-Fill AI
 */

(function() {
  'use strict';

  const GRID_W = 80;
  const GRID_H = 60;
  const BASE_STEP_INTERVAL = 5; // 基础步进间隔 (帧数)：约 12 步/秒
  const BOOST_STEP_INTERVAL = 3; // 过载加速步进间隔 (帧数)：约 20 步/秒 (1.67倍速)
  const BOOST_DURATION_FRAMES = 72; // 过载持续 1.2 秒 (72帧@60FPS)

  const TRON_STATE = {
    mode: 'AI1', // 'AI1', 'AI3', 'LOCAL2', 'LOCAL4'
    targetScore: 3,
    phase: 'INIT', // 'COUNTDOWN', 'PLAYING', 'ROUND_OVER', 'MATCH_OVER'
    countdownVal: 3,
    countdownTimer: null,
    roundTimer: null,
    roundWinner: null,
    matchWinner: null,
    animId: null,
    shakeFrames: 0,
    particles: [],
    grid: null // Uint8Array(GRID_W * GRID_H)
  };

  const AI_VISITED = new Uint8Array(GRID_W * GRID_H);

  const PLAYERS_CONFIG = [
    {
      id: 1,
      name: '🔴 P1 (红方)',
      shortName: 'P1',
      color: '#ff4757',
      trailColor: '#ff6b81',
      glowColor: 'rgba(255, 71, 87, 0.9)',
      startX: 14,
      startY: 30,
      startDir: { x: 1, y: 0 }
    },
    {
      id: 2,
      name: '🟢 P2 (绿方)',
      shortName: 'P2',
      color: '#2ed573',
      trailColor: '#7bed9f',
      glowColor: 'rgba(46, 213, 115, 0.9)',
      startX: 65,
      startY: 30,
      startDir: { x: -1, y: 0 }
    },
    {
      id: 3,
      name: '🔵 P3 (蓝方)',
      shortName: 'P3',
      color: '#1e90ff',
      trailColor: '#70a1ff',
      glowColor: 'rgba(30, 144, 255, 0.9)',
      startX: 40,
      startY: 12,
      startDir: { x: 0, y: 1 }
    },
    {
      id: 4,
      name: '🟡 P4 (黄方)',
      shortName: 'P4',
      color: '#ffa502',
      trailColor: '#eccc68',
      glowColor: 'rgba(255, 165, 2, 0.9)',
      startX: 40,
      startY: 47,
      startDir: { x: 0, y: -1 }
    }
  ];

  let players = [];

  const canvas = document.getElementById('tron-canvas');
  const ctx = canvas.getContext('2d');

  function initPlayers() {
    players = PLAYERS_CONFIG.map(cfg => {
      let isAi = false;
      let active = false;

      if (TRON_STATE.mode === 'AI1') {
        if (cfg.id === 1) { active = true; isAi = false; }
        else if (cfg.id === 2) { active = true; isAi = true; }
      } else if (TRON_STATE.mode === 'AI3') {
        active = true;
        isAi = cfg.id !== 1;
      } else if (TRON_STATE.mode === 'LOCAL2') {
        if (cfg.id <= 2) { active = true; isAi = false; }
      } else if (TRON_STATE.mode === 'LOCAL4') {
        active = true;
        isAi = false;
      }

      return {
        ...cfg,
        active,
        isAi,
        x: cfg.startX,
        y: cfg.startY,
        prevX: cfg.startX,
        prevY: cfg.startY,
        dir: { ...cfg.startDir },
        nextDir: { ...cfg.startDir },
        alive: true,
        score: 0,
        hasBoost: true,
        boosting: false,
        boostTimer: 0,
        stepCounter: 0,
        stepProgress: 0, // 0..1 用于两步间渲染插值平滑
        trail: []
      };
    });
  }

  function resetGrid() {
    TRON_STATE.grid = new Uint8Array(GRID_W * GRID_H);
  }

  function getCell(x, y) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return 255;
    return TRON_STATE.grid[y * GRID_W + x];
  }

  function setCell(x, y, val) {
    if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
      TRON_STATE.grid[y * GRID_W + x] = val;
    }
  }

  // ==========================================================================
  // 回合生命周期流转
  // ==========================================================================

  function resetTronRound() {
    if (TRON_STATE.roundTimer) {
      clearTimeout(TRON_STATE.roundTimer);
      TRON_STATE.roundTimer = null;
    }
    if (TRON_STATE.countdownTimer) {
      clearInterval(TRON_STATE.countdownTimer);
      TRON_STATE.countdownTimer = null;
    }
    resetGrid();
    TRON_STATE.roundWinner = null;
    TRON_STATE.particles = [];
    TRON_STATE.shakeFrames = 0;

    players.forEach(p => {
      p.x = p.startX;
      p.y = p.startY;
      p.prevX = p.startX;
      p.prevY = p.startY;
      p.dir = { ...p.startDir };
      p.nextDir = { ...p.startDir };
      p.alive = p.active;
      p.hasBoost = true;
      p.boosting = false;
      p.boostTimer = 0;
      p.stepCounter = 0;
      p.stepProgress = 0;
      p.trail = [];

      if (p.active) {
        setCell(p.x, p.y, p.id);
        p.trail.push({ x: p.x, y: p.y });
      }
    });

    updateHUD();
    startCountdown();
  }

  function startCountdown() {
    TRON_STATE.phase = 'COUNTDOWN';
    TRON_STATE.countdownVal = 3;

    const overlay = document.getElementById('tron-overlay');
    const textEl = document.getElementById('tron-countdown-text');
    const noticeEl = document.getElementById('tron-round-notice');

    if (overlay && textEl) {
      overlay.classList.remove('hidden');
      noticeEl.textContent = '准备发动光轮引擎...';
      textEl.textContent = '3';
      textEl.style.color = '';
      textEl.style.textShadow = '';
    }

    if (window.AUDIO) window.AUDIO.play('click');

    if (TRON_STATE.countdownTimer) clearInterval(TRON_STATE.countdownTimer);

    TRON_STATE.countdownTimer = setInterval(() => {
      TRON_STATE.countdownVal--;
      if (TRON_STATE.countdownVal > 0) {
        if (textEl) {
          textEl.textContent = TRON_STATE.countdownVal;
          textEl.style.animation = 'none';
          void textEl.offsetWidth; // 触发重绘重播动画
          textEl.style.animation = 'scalePop 0.8s ease-out';
        }
        if (window.AUDIO) window.AUDIO.play('click');
      } else if (TRON_STATE.countdownVal === 0) {
        if (textEl) {
          textEl.textContent = 'GO!';
          textEl.style.color = '#2ed573';
          textEl.style.textShadow = '0 0 30px #2ed573, 0 0 60px #10b981';
        }
        if (window.AUDIO) window.AUDIO.play('tron_boost');
      } else {
        clearInterval(TRON_STATE.countdownTimer);
        TRON_STATE.countdownTimer = null;
        if (overlay) overlay.classList.add('hidden');
        TRON_STATE.phase = 'PLAYING';
      }
    }, 850);
  }

  function handlePlayerCrash(p) {
    if (!p.alive) return;
    p.alive = false;
    p.boosting = false;
    TRON_STATE.shakeFrames = 14;

    // 碎裂霓虹火花粒子
    spawnCrashSparks(p.x, p.y, p.color);

    if (window.AUDIO) {
      try { window.AUDIO.play('contra_explode'); } catch(e) {}
    }

    updateHUD();
    checkRoundEnd();
  }

  function checkRoundEnd() {
    const activePlayers = players.filter(p => p.active);
    const alivePlayers = activePlayers.filter(p => p.alive);

    if (alivePlayers.length <= 1) {
      TRON_STATE.phase = 'ROUND_OVER';
      let roundNotice = '';

      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        winner.score++;
        TRON_STATE.roundWinner = winner;
        roundNotice = `🏆 ${winner.name} 夺得本局胜利！`;
        if (window.showToast) window.showToast(roundNotice, 2200);
      } else {
        roundNotice = `💥 势均力敌！全员同归于尽！`;
        if (window.showToast) window.showToast(roundNotice, 2200);
      }

      updateHUD();

      // 检查是否决出总冠军
      const matchWinner = activePlayers.find(p => p.score >= TRON_STATE.targetScore);
      if (matchWinner) {
        TRON_STATE.matchWinner = matchWinner;
        TRON_STATE.phase = 'MATCH_OVER';
        if (window.AUDIO) window.AUDIO.play('win');

        TRON_STATE.roundTimer = setTimeout(() => {
          if (window.showModal && TRON_STATE.phase === 'MATCH_OVER') {
            const scoreHtml = activePlayers
              .map(p => `<li style="margin:4px 0;"><b>${p.name}</b>: ${p.score} 胜</li>`)
              .join('');
            window.showModal('🏆 极光光轮摩托·终局总冠军！', `
              <p style="font-size:1.05rem; margin-bottom:12px;">恭喜 <strong style="color:${matchWinner.color};">${matchWinner.name}</strong> 率先达成 <b>${TRON_STATE.targetScore} 胜</b> 夺冠！</p>
              <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:10px 16px;">
                <p style="font-size:0.85rem; color:#94a3b8; margin-bottom:6px;">📊 最终比分榜：</p>
                <ul style="padding-left:18px; font-size:0.9rem;">${scoreHtml}</ul>
              </div>
            `, { isGameOver: true });
          }
        }, 600);
      } else {
        // 延时进入下一局
        TRON_STATE.roundTimer = setTimeout(() => {
          if (TRON_STATE.phase === 'ROUND_OVER') {
            resetTronRound();
          }
        }, 1600);
      }
    }
  }

  // ==========================================================================
  // 60FPS 运动更新与碰撞检测 (Fixed Step & Smooth Lerp)
  // ==========================================================================

  function updateGame() {
    if (TRON_STATE.phase !== 'PLAYING') return;

    // 1. AI 决策与预判 (在步进节点按需评估，避免每帧重复计算)
    players.forEach(p => {
      if (p.active && p.alive && p.isAi && (p.stepCounter === 0 || p.stepCounter === 1)) {
        updateTronAiDecision(p);
      }
    });

    // 2. 收集本物理帧触发网格步进的玩家
    const advancingPlayers = [];
    players.forEach(p => {
      if (!p.active || !p.alive) return;

      if (p.boosting) {
        p.boostTimer--;
        if (p.boostTimer <= 0) {
          p.boosting = false;
          updateHUD();
        }
      }

      const stepInterval = p.boosting ? BOOST_STEP_INTERVAL : BASE_STEP_INTERVAL;
      p.stepCounter++;
      p.stepProgress = Math.min(1, p.stepCounter / stepInterval);

      if (p.stepCounter >= stepInterval) {
        p.stepCounter = 0;
        p.stepProgress = 0;
        p.prevX = p.x;
        p.prevY = p.y;
        p.dir = { ...p.nextDir };
        p.targetX = p.x + p.dir.x;
        p.targetY = p.y + p.dir.y;
        p.crashedThisStep = false;
        advancingPlayers.push(p);
      }
    });

    if (advancingPlayers.length > 0) {
      // 3. 步进物理与碰撞判定 (首要解决迎头同入一格与对穿相互毁灭)
      // 3.1 两人同时意图进入同一目标格，或迎头对穿对撞
      for (let i = 0; i < advancingPlayers.length; i++) {
        for (let j = i + 1; j < advancingPlayers.length; j++) {
          const p1 = advancingPlayers[i];
          const p2 = advancingPlayers[j];
          if (p1.targetX === p2.targetX && p1.targetY === p2.targetY) {
            p1.crashedThisStep = true;
            p2.crashedThisStep = true;
          } else if (p1.targetX === p2.prevX && p1.targetY === p2.prevY && p2.targetX === p1.prevX && p2.targetY === p1.prevY) {
            p1.crashedThisStep = true;
            p2.crashedThisStep = true;
          }
        }
      }

      // 3.2 撞击外围光壁或既有光轨
      advancingPlayers.forEach(p => {
        if (p.crashedThisStep) return;

        // 撞外墙检测
        if (p.targetX < 0 || p.targetX >= GRID_W || p.targetY < 0 || p.targetY >= GRID_H) {
          p.crashedThisStep = true;
          return;
        }

        // 撞存留光轨检测
        const cell = getCell(p.targetX, p.targetY);
        if (cell > 0) {
          p.crashedThisStep = true;
        }
      });

      // 3.3 提交位置变更或阵亡
      advancingPlayers.forEach(p => {
        if (p.crashedThisStep) {
          handlePlayerCrash(p);
        } else {
          p.x = p.targetX;
          p.y = p.targetY;
          setCell(p.x, p.y, p.id);
          p.trail.push({ x: p.x, y: p.y });
        }
      });
    }

    // 4. 过载喷气尾焰粒子
    players.forEach(p => {
      if (p.active && p.alive && p.boosting) {
        if (Math.random() < 0.65) {
          spawnJetParticles(p.x, p.y, p.color);
        }
      }
    });
  }

  // ==========================================================================
  // 智能 Flood-Fill 连通域决策模型 (AI Heuristics)
  // ==========================================================================

  function updateTronAiDecision(ai) {
    // 候选朝向：保持直行、左转90度、右转90度
    const currentDir = ai.dir;
    const leftTurn = { x: currentDir.y, y: -currentDir.x };
    const rightTurn = { x: -currentDir.y, y: currentDir.x };

    const candidates = [
      { dir: currentDir, type: 'straight' },
      { dir: leftTurn, type: 'left' },
      { dir: rightTurn, type: 'right' }
    ];

    let bestScore = -Infinity;
    let chosenDir = currentDir;

    candidates.forEach(c => {
      const nx = ai.x + c.dir.x;
      const ny = ai.y + c.dir.y;

      // 致命撞墙或撞轨直接淘汰
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H || getCell(nx, ny) > 0) {
        return;
      }

      // BFS 泛洪填充评估连通空旷度 (最多探测 160 格)
      const space = calculateFloodFillSpace(nx, ny, 160);

      // 直行有轻微倾向奖励，避免频繁无意义急转
      let score = space;
      if (c.type === 'straight') score += 5;

      // 避开距离对手太近的迎头威胁
      const isRisky = players.some(other => {
        if (!other.active || !other.alive || other.id === ai.id) return false;
        const dist = Math.abs(other.x - nx) + Math.abs(other.y - ny);
        return dist <= 2;
      });
      if (isRisky) score -= 15;

      if (score > bestScore) {
        bestScore = score;
        chosenDir = c.dir;
      }
    });

    if (chosenDir.x !== ai.dir.x || chosenDir.y !== ai.dir.y) {
      changePlayerDir(ai, chosenDir);
    }

    // 智能过载决策：空间开阔且有封路机会或紧急逃生
    if (ai.hasBoost && !ai.boosting) {
      if (bestScore > 75) {
        const closeEnemy = players.some(other => {
          if (!other.active || !other.alive || other.id === ai.id) return false;
          const dist = Math.abs(other.x - ai.x) + Math.abs(other.y - ai.y);
          return dist > 5 && dist < 18;
        });
        if (closeEnemy && Math.random() < 0.04) {
          triggerPlayerBoost(ai);
        }
      }
    }
  }

  function calculateFloodFillSpace(startX, startY, maxDepth) {
    let queue = [startX | (startY << 8)];
    AI_VISITED[startY * GRID_W + startX] = 1;
    let count = 0;

    let head = 0;
    while (head < queue.length && count < maxDepth) {
      const val = queue[head++];
      const cx = val & 0xff;
      const cy = (val >> 8) & 0xff;
      count++;

      const neighbors = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 }
      ];

      for (let i = 0; i < 4; i++) {
        const n = neighbors[i];
        if (n.x >= 0 && n.x < GRID_W && n.y >= 0 && n.y < GRID_H) {
          const idx = n.y * GRID_W + n.x;
          if (AI_VISITED[idx] === 0 && getCell(n.x, n.y) === 0) {
            AI_VISITED[idx] = 1;
            queue.push(n.x | (n.y << 8));
          }
        }
      }
    }

    // 零分配还原标记，防止内存泄漏或GC卡顿
    for (let i = 0; i < queue.length; i++) {
      const v = queue[i];
      AI_VISITED[((v >> 8) & 0xff) * GRID_W + (v & 0xff)] = 0;
    }

    return count;
  }

  // ==========================================================================
  // 输入与方向控制
  // ==========================================================================

  function changePlayerDir(p, newDir) {
    if (!p.alive || TRON_STATE.phase !== 'PLAYING') return;
    // 禁止 180° 自杀掉头
    if (newDir.x === -p.dir.x && newDir.y === -p.dir.y) return;
    if (newDir.x === p.dir.x && newDir.y === p.dir.y) return;

    p.nextDir = { ...newDir };
    if (!p.isAi && window.AUDIO) {
      window.AUDIO.play('tron_turn');
    }
  }

  function triggerPlayerBoost(p) {
    if (!p.alive || !p.hasBoost || p.boosting || TRON_STATE.phase !== 'PLAYING') return;
    p.hasBoost = false;
    p.boosting = true;
    p.boostTimer = BOOST_DURATION_FRAMES;
    if (window.AUDIO) {
      window.AUDIO.play('tron_boost');
    }
    updateHUD();
  }

  // 键盘事件分派
  function setupKeyControls() {
    window.addEventListener('keydown', e => {
      if (TRON_STATE.phase !== 'PLAYING') return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // P1 (WASD + Q)
      const p1 = players[0];
      if (p1 && p1.active && !p1.isAi) {
        if (code === 'KeyW' || key === 'w') changePlayerDir(p1, { x: 0, y: -1 });
        else if (code === 'KeyS' || key === 's') changePlayerDir(p1, { x: 0, y: 1 });
        else if (code === 'KeyA' || key === 'a') changePlayerDir(p1, { x: -1, y: 0 });
        else if (code === 'KeyD' || key === 'd') changePlayerDir(p1, { x: 1, y: 0 });
        else if (code === 'KeyQ' || key === 'q') triggerPlayerBoost(p1);
      }

      // P2 (Arrow Keys + Enter/M)
      const p2 = players[1];
      if (p2 && p2.active && !p2.isAi) {
        if (code === 'ArrowUp') { e.preventDefault(); changePlayerDir(p2, { x: 0, y: -1 }); }
        else if (code === 'ArrowDown') { e.preventDefault(); changePlayerDir(p2, { x: 0, y: 1 }); }
        else if (code === 'ArrowLeft') { e.preventDefault(); changePlayerDir(p2, { x: -1, y: 0 }); }
        else if (code === 'ArrowRight') { e.preventDefault(); changePlayerDir(p2, { x: 1, y: 0 }); }
        else if (code === 'Enter') { e.preventDefault(); triggerPlayerBoost(p2); }
        else if (code === 'KeyM' || key === 'm') triggerPlayerBoost(p2);
      }

      // P3 (IJKL + U)
      const p3 = players[2];
      if (p3 && p3.active && !p3.isAi) {
        if (code === 'KeyI' || key === 'i') changePlayerDir(p3, { x: 0, y: -1 });
        else if (code === 'KeyK' || key === 'k') changePlayerDir(p3, { x: 0, y: 1 });
        else if (code === 'KeyJ' || key === 'j') changePlayerDir(p3, { x: -1, y: 0 });
        else if (code === 'KeyL' || key === 'l') changePlayerDir(p3, { x: 1, y: 0 });
        else if (code === 'KeyU' || key === 'u') triggerPlayerBoost(p3);
      }

      // P4 (TFGH / Numpad 8456 + R)
      const p4 = players[3];
      if (p4 && p4.active && !p4.isAi) {
        if (code === 'KeyT' || key === 't') changePlayerDir(p4, { x: 0, y: -1 });
        else if (code === 'Numpad8' || key === '8') { e.preventDefault(); changePlayerDir(p4, { x: 0, y: -1 }); }
        else if (code === 'KeyG' || key === 'g') changePlayerDir(p4, { x: 0, y: 1 });
        else if (code === 'Numpad5' || key === '5') { e.preventDefault(); changePlayerDir(p4, { x: 0, y: 1 }); }
        else if (code === 'KeyF' || key === 'f') changePlayerDir(p4, { x: -1, y: 0 });
        else if (code === 'Numpad4' || key === '4') { e.preventDefault(); changePlayerDir(p4, { x: -1, y: 0 }); }
        else if (code === 'KeyH' || key === 'h') changePlayerDir(p4, { x: 1, y: 0 });
        else if (code === 'Numpad6' || key === '6') { e.preventDefault(); changePlayerDir(p4, { x: 1, y: 0 }); }
        else if (code === 'KeyR' || key === 'r') triggerPlayerBoost(p4);
      }
    });
  }

  // 移动端相对转向交互 (Relative Left/Right Turn)
  window.handleTouchTurn = function(playerId, turnSide, e) {
    if (e && e.preventDefault) e.preventDefault();
    const p = players[playerId - 1];
    if (!p || !p.active || !p.alive || p.isAi) return;

    let newDir;
    if (turnSide === 'left') {
      // 逆时针 90 度
      newDir = { x: p.dir.y, y: -p.dir.x };
    } else {
      // 顺时针 90 度
      newDir = { x: -p.dir.y, y: p.dir.x };
    }
    changePlayerDir(p, newDir);
  };

  window.handleTouchBoost = function(playerId, e) {
    if (e && e.preventDefault) e.preventDefault();
    const p = players[playerId - 1];
    if (!p || !p.active || !p.alive || p.isAi) return;
    triggerPlayerBoost(p);
  };

  // ==========================================================================
  // 粒子系统与屏幕震颤
  // ==========================================================================

  function spawnCrashSparks(gx, gy, color) {
    const w = canvas.width;
    const h = canvas.height;
    const px = (gx + 0.5) * (w / GRID_W);
    const py = (gy + 0.5) * (h / GRID_H);

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2;
      TRON_STATE.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3.5 + 2,
        life: 1.0,
        decay: Math.random() * 0.035 + 0.02
      });
    }
  }

  function spawnJetParticles(gx, gy, color) {
    const w = canvas.width;
    const h = canvas.height;
    const px = (gx + 0.5) * (w / GRID_W);
    const py = (gy + 0.5) * (h / GRID_H);

    for (let i = 0; i < 3; i++) {
      TRON_STATE.particles.push({
        x: px + (Math.random() - 0.5) * 6,
        y: py + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        color: '#fbbf24',
        size: Math.random() * 2.5 + 1.5,
        life: 0.8,
        decay: 0.06
      });
    }
  }

  function updateParticles() {
    for (let i = TRON_STATE.particles.length - 1; i >= 0; i--) {
      const pt = TRON_STATE.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= pt.decay;
      if (pt.life <= 0) {
        TRON_STATE.particles.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // Canvas 2D 发光渲染管线
  // ==========================================================================

  function renderGame() {
    const cw = canvas.width;
    const ch = canvas.height;
    const cellW = cw / GRID_W;
    const cellH = ch / GRID_H;

    ctx.save();

    // 屏幕震颤偏移
    if (TRON_STATE.shakeFrames > 0) {
      const sx = (Math.random() - 0.5) * 12;
      const sy = (Math.random() - 0.5) * 12;
      ctx.translate(sx, sy);
      TRON_STATE.shakeFrames--;
    }

    // 1. 深渊黑夜背景与赛博发光网格
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= GRID_W; x += 4) {
      ctx.moveTo(x * cellW, 0);
      ctx.lineTo(x * cellW, ch);
    }
    for (let y = 0; y <= GRID_H; y += 4) {
      ctx.moveTo(0, y * cellH);
      ctx.lineTo(cw, y * cellH);
    }
    ctx.stroke();

    // 2. 竞技场外围防撞霓虹光壁
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.strokeRect(1.5, 1.5, cw - 3, ch - 3);
    ctx.shadowBlur = 0;

    // 3. 绘制玩家光轨 (Light Wall Trails)
    players.forEach(p => {
      if (!p.active || p.trail.length === 0) return;

      ctx.save();
      ctx.strokeStyle = p.trailColor;
      ctx.fillStyle = p.trailColor;
      ctx.shadowColor = p.glowColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = Math.max(2, cellW * 0.75);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const cx = (pt.x + 0.5) * cellW;
        const cy = (pt.y + 0.5) * cellH;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }

      // 如果存活，平滑连线至当前插值车头位置
      if (p.alive) {
        const headInterpX = (p.prevX + (p.x - p.prevX) * p.stepProgress + 0.5) * cellW;
        const headInterpY = (p.prevY + (p.y - p.prevY) * p.stepProgress + 0.5) * cellH;
        ctx.lineTo(headInterpX, headInterpY);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 4. 绘制光轮摩托车头 (Bike Heads & Headlights)
    players.forEach(p => {
      if (!p.active || !p.alive) return;

      const curX = (p.prevX + (p.x - p.prevX) * p.stepProgress + 0.5) * cellW;
      const curY = (p.prevY + (p.y - p.prevY) * p.stepProgress + 0.5) * cellH;

      ctx.save();
      ctx.translate(curX, curY);

      // 计算车头旋转角度
      const angle = Math.atan2(p.dir.y, p.dir.x);
      ctx.rotate(angle);

      // 前照大灯光束 (Cone Light)
      const grad = ctx.createRadialGradient(0, 0, 2, 28, 0, 36);
      grad.addColorStop(0, p.glowColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 36, -Math.PI / 5, Math.PI / 5);
      ctx.closePath();
      ctx.fill();

      // 车头机体
      ctx.shadowColor = p.glowColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-cellW * 0.45, -cellH * 0.35, cellW * 0.9, cellH * 0.7);

      ctx.fillStyle = p.color;
      ctx.fillRect(-cellW * 0.25, -cellH * 0.2, cellW * 0.6, cellH * 0.4);

      // 过载光环
      if (p.boosting) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, cellW * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 5. 渲染碎裂火花粒子
    updateParticles();
    TRON_STATE.particles.forEach(pt => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  // ==========================================================================
  // 主循环 (60FPS Fixed-Step Loop)
  // ==========================================================================

  let lastTime = performance.now();
  let accumulator = 0;
  const FIXED_STEP = 1000 / 60;

  function gameLoop(now) {
    if (!now) now = performance.now();
    let elapsed = now - lastTime;
    lastTime = now;
    if (elapsed > 100) elapsed = 100;
    accumulator += elapsed;

    while (accumulator >= FIXED_STEP) {
      updateGame();
      accumulator -= FIXED_STEP;
    }

    renderGame();
    TRON_STATE.animId = requestAnimationFrame(gameLoop);
  }

  // ==========================================================================
  // HUD 与视图状态同步
  // ==========================================================================

  function updateHUD() {
    players.forEach(p => {
      const card = document.getElementById(`tron-card-p${p.id}`);
      const nameEl = document.getElementById(`tron-name-p${p.id}`);
      const scoreEl = document.getElementById(`tron-score-p${p.id}`);
      const statusEl = document.getElementById(`tron-status-p${p.id}`);
      const boostEl = document.getElementById(`tron-boost-p${p.id}`);
      const touchPad = document.getElementById(`touch-pad-p${p.id}`);
      const hintRow = document.getElementById(`hint-p${p.id}`);

      if (card) {
        card.style.display = p.active ? 'flex' : 'none';
        card.classList.toggle('dead', !p.alive);
      }
      if (touchPad) {
        touchPad.style.display = p.active && !p.isAi ? 'flex' : 'none';
      }
      if (hintRow) {
        hintRow.style.display = p.active ? 'flex' : 'none';
      }

      if (nameEl) {
        const roleText = p.isAi ? ' (电脑AI)' : '';
        nameEl.textContent = `${p.shortName} ${p.color === '#ff4757' ? '红' : p.color === '#2ed573' ? '绿' : p.color === '#1e90ff' ? '蓝' : '黄'}${roleText}`;
      }
      if (scoreEl) scoreEl.textContent = p.score;
      if (statusEl) {
        statusEl.textContent = p.alive ? '存活' : '💥阵亡';
      }
      if (boostEl) {
        boostEl.className = 'tron-boost-pill' + (p.boosting ? ' active' : p.hasBoost ? '' : ' used');
        boostEl.textContent = p.boosting ? '⚡ 喷射中!' : p.hasBoost ? '⚡ 过载就绪' : '⚡ 耗尽';
      }
    });
  }

  function resizeCanvas() {
    const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : null;
    const dpr = window.devicePixelRatio || 1;
    const w = (rect && rect.width > 0) ? rect.width : 640;
    const h = (rect && rect.height > 0) ? rect.height : 480;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }

  // 模式切换
  window.switchTronMode = function(mode) {
    TRON_STATE.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tab-${mode.toLowerCase()}`);
    if (tab) tab.classList.add('active');

    initPlayers();
    resetTronRound();
  };

  // 目标胜场
  window.setTronTargetScore = function(score) {
    TRON_STATE.targetScore = score;
    document.getElementById('btn-target-3').classList.toggle('active', score === 3);
    document.getElementById('btn-target-5').classList.toggle('active', score === 5);
    if (window.showToast) window.showToast(`🏁 比赛目标设置为率先达成 ${score} 胜！`, 1800);
  };

  // 重置对局
  function resetCurrentGame() {
    players.forEach(p => p.score = 0);
    resetTronRound();
  }

  // ==========================================================================
  // 初始化与规则说明
  // ==========================================================================

  window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupKeyControls();
    initPlayers();
    resetTronRound();

    if (window.initCommonHeader) {
      window.initCommonHeader(
        "🏍️ 极光光轮摩托 (Tron Light 4P) 规则与指南",
        `
          <p><strong>经典赛博封路对决：</strong>每位玩家驾驶超速光轮摩托，身后拖曳出实体发光激光墙！</p><br>
          <p><strong>💥 致命碰撞规则：</strong></p>
          <ul>
            <li>撞击竞技场外壁 ➔ 💥 淘汰出局！</li>
            <li>撞击任何存留的光轨（包括自己和对手） ➔ 💥 淘汰出局！</li>
            <li>两人迎头正面相撞 ➔ 💥 双双同归于尽！</li>
          </ul><br>
          <p><strong>⚡ 1.6 倍速过载喷射 (Overdrive)：</strong></p>
          <ul>
            <li>每回合每人拥有 <b>1 次</b> 紧急过载加速机会，持续 1.2 秒！</li>
            <li>用于在弯心抢先封死对手退路，或脱离险境死角！</li>
          </ul><br>
          <p><strong>🎮 PC 键位完全独立无冲突：</strong></p>
          <ul>
            <li><b>🔴 P1 (红方)：</b> <b>WASD</b> 转向，<b>Q</b> 过载加速</li>
            <li><b>🟢 P2 (绿方)：</b> <b>方向键 ↑↓←→</b> 转向，<b>Enter / M</b> 过载加速</li>
            <li><b>🔵 P3 (蓝方)：</b> <b>IJKL</b> 转向，<b>U</b> 过载加速</li>
            <li><b>🟡 P4 (黄方)：</b> <b>小键盘 8456 / TFGH</b> 转向，<b>R</b> 过载加速</li>
            <li><b>📱 触控端：</b> 屏幕提供左转 ↶ / 右转 ↷ 相对转向与过载按键！</li>
          </ul><br>
          <p><strong>🏆 胜负判定：</strong>坚持到最后的唯一幸存者斩获 1 胜，率先达成 3 胜或 5 胜荣膺总冠军！</p>
        `,
        resetCurrentGame
      );
    }

    // 启动 60FPS 渲染物理循环
    TRON_STATE.animId = requestAnimationFrame(gameLoop);
  });

})();
