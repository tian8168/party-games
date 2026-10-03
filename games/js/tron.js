/**
 * 🏍️ 极光光轮摩托 (Tron Light Cycles 4P) · 《马里奥赛车式：道具大乱斗》
 * 纯原生 Canvas 2D 霓虹发光管线 · 60FPS 运动平滑与碰撞检测 · 1~4 人模式 · 智能 Flood-Fill AI
 * 升级特性：神秘道具箱随机刷新，破墙飞弹、穿墙幽灵、超频氮气、EMP震撼波即时触发
 */

(function() {
  'use strict';

  const GRID_W = 80;
  const GRID_H = 60;
  const BASE_STEP_INTERVAL = 5; // 基础步进间隔 (帧数)：约 12 步/秒
  const BOOST_STEP_INTERVAL = 3; // 过载加速步进间隔 (帧数)：约 20 步/秒 (1.67倍速)
  const SUPER_BOOST_STEP_INTERVAL = 2; // 超频氮气步进间隔 (帧数)：约 30 步/秒 (2.5倍速)
  const BOOST_DURATION_FRAMES = 72; // 基础过载持续 1.2 秒 (72帧@60FPS)
  const GHOST_DURATION_FRAMES = 180; // 穿墙幽灵持续 3.0 秒 (180帧@60FPS)
  const SUPER_BOOST_DURATION_FRAMES = 135; // 超频氮气持续 2.25 秒
  const EMP_DURATION_FRAMES = 210; // EMP 震撼波持续 3.5 秒 (210帧@60FPS)
  const MAX_MYSTERY_BOXES = 3; // 场上同时存在的神秘道具箱上限
  const BOX_SPAWN_INTERVAL_FRAMES = 210; // 约每 3.5 秒刷新检查

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
    crtGlitchTimer: 0,
    boxSpawnTimer: 0,
    particles: [],
    mysteryBoxes: [],
    missiles: [],
    shockwaves: [],
    floatingTexts: [],
    grid: null // Uint8Array(GRID_W * GRID_H)
  };

  let boxIdCounter = 0;
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
        trail: [],

        // 道具大乱斗状态
        isGhost: false,
        ghostTimer: 0,
        superBoosting: false,
        superBoostTimer: 0,
        empTimer: 0,
        lastItemName: null,
        itemDisplayTimer: 0
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
    TRON_STATE.mysteryBoxes = [];
    TRON_STATE.missiles = [];
    TRON_STATE.shockwaves = [];
    TRON_STATE.floatingTexts = [];
    TRON_STATE.shakeFrames = 0;
    TRON_STATE.crtGlitchTimer = 0;
    TRON_STATE.boxSpawnTimer = 0;

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

      p.isGhost = false;
      p.ghostTimer = 0;
      p.superBoosting = false;
      p.superBoostTimer = 0;
      p.empTimer = 0;
      p.lastItemName = null;
      p.itemDisplayTimer = 0;

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

        // 比赛开局即刷出 2 个神秘道具箱
        spawnMysteryBox();
        spawnMysteryBox();
      }
    }, 850);
  }

  function handlePlayerCrash(p, skipRoundEndCheck = false) {
    if (!p.alive) return;
    p.alive = false;
    p.boosting = false;
    p.superBoosting = false;
    p.isGhost = false;
    TRON_STATE.shakeFrames = 14;

    // 碎裂霓虹火花粒子
    spawnCrashSparks(p.x, p.y, p.color);

    if (window.AUDIO) {
      try { window.AUDIO.play('contra_explode'); } catch(e) {}
    }

    updateHUD();
    if (!skipRoundEndCheck) {
      checkRoundEnd();
    }
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
  // 神秘道具箱生成、拾取与大乱斗道具效果
  // ==========================================================================

  function spawnMysteryBox() {
    if (TRON_STATE.phase !== 'PLAYING') return;
    if (TRON_STATE.mysteryBoxes.length >= MAX_MYSTERY_BOXES) return;

    for (let attempts = 0; attempts < 35; attempts++) {
      const rx = Math.floor(Math.random() * (GRID_W - 14)) + 7;
      const ry = Math.floor(Math.random() * (GRID_H - 14)) + 7;

      if (getCell(rx, ry) !== 0) continue;

      const alreadyHasBox = TRON_STATE.mysteryBoxes.some(b => b.x === rx && b.y === ry);
      if (alreadyHasBox) continue;

      const tooClose = players.some(p => p.active && p.alive && (Math.abs(p.x - rx) + Math.abs(p.y - ry) < 5));
      if (tooClose) continue;

      TRON_STATE.mysteryBoxes.push({
        id: ++boxIdCounter,
        x: rx,
        y: ry,
        createdAt: performance.now(),
        hoverOffset: Math.random() * Math.PI * 2
      });
      break;
    }
  }

  function checkMysteryBoxPickups() {
    if (TRON_STATE.mysteryBoxes.length === 0) return;

    for (let i = TRON_STATE.mysteryBoxes.length - 1; i >= 0; i--) {
      const box = TRON_STATE.mysteryBoxes[i];
      const picker = players.find(p => p.active && p.alive && p.x === box.x && p.y === box.y);
      if (picker) {
        TRON_STATE.mysteryBoxes.splice(i, 1);
        handlePlayerPickupItem(picker, box.x, box.y);
      }
    }
  }

  function handlePlayerPickupItem(p, bx, by) {
    if (window.AUDIO) {
      window.AUDIO.play('tron_item_pickup');
    }

    spawnPickupSparks(bx, by, p.color);

    const pool = ['MISSILE', 'GHOST', 'SUPER_BOOST', 'EMP'];
    const chosenType = pool[Math.floor(Math.random() * pool.length)];

    if (chosenType === 'MISSILE') {
      launchMissile(p);
    } else if (chosenType === 'GHOST') {
      activateGhostMode(p);
    } else if (chosenType === 'SUPER_BOOST') {
      activateSuperBoost(p);
    } else if (chosenType === 'EMP') {
      triggerEmpShockwave(p);
    }

    updateHUD();
  }

  function launchMissile(p) {
    p.lastItemName = '🚀 飞弹击发!';
    p.itemDisplayTimer = 70;

    const missile = {
      id: Date.now() + Math.random(),
      x: p.x + p.dir.x * 1.2,
      y: p.y + p.dir.y * 1.2,
      vx: p.dir.x * 1.6,
      vy: p.dir.y * 1.6,
      dir: { ...p.dir },
      ownerId: p.id,
      color: p.color
    };
    TRON_STATE.missiles.push(missile);

    spawnFloatingText(p.x, p.y, '🚀 破墙飞弹!', '#f97316');

    if (window.AUDIO) {
      window.AUDIO.play('tron_missile');
    }
  }

  function activateGhostMode(p) {
    p.isGhost = true;
    p.ghostTimer = GHOST_DURATION_FRAMES;
    p.lastItemName = '👻 穿墙幽灵!';
    p.itemDisplayTimer = GHOST_DURATION_FRAMES;

    spawnFloatingText(p.x, p.y, '👻 穿墙幽灵!', '#c084fc');

    if (window.AUDIO) {
      window.AUDIO.play('tron_ghost');
    }
  }

  function activateSuperBoost(p) {
    p.superBoosting = true;
    p.superBoostTimer = SUPER_BOOST_DURATION_FRAMES;
    p.lastItemName = '⚡ 超频暴走!';
    p.itemDisplayTimer = SUPER_BOOST_DURATION_FRAMES;

    spawnFloatingText(p.x, p.y, '⚡ 超频暴走!', '#fbbf24');

    if (window.AUDIO) {
      window.AUDIO.play('tron_super_boost');
    }
  }

  function triggerEmpShockwave(p) {
    p.lastItemName = '💣 EMP震慑!';
    p.itemDisplayTimer = 80;

    const cw = canvas.width;
    const ch = canvas.height;
    TRON_STATE.shockwaves.push({
      x: (p.x + 0.5) * (cw / GRID_W),
      y: (p.y + 0.5) * (ch / GRID_H),
      radius: 12,
      maxRadius: Math.max(cw, ch) * 0.95,
      color: '#818cf8',
      life: 1.0,
      decay: 0.035
    });

    TRON_STATE.shakeFrames = 10;
    TRON_STATE.crtGlitchTimer = 18;

    spawnFloatingText(p.x, p.y, '💣 全场EMP!', '#ec4899');

    // 震慑全场其他所有对手
    players.forEach(other => {
      if (other.active && other.alive && other.id !== p.id) {
        other.empTimer = EMP_DURATION_FRAMES;
        spawnFloatingText(other.x, other.y, '⚡ 操控反转!', '#818cf8');
      }
    });

    if (window.AUDIO) {
      window.AUDIO.play('tron_emp');
    }

    if (window.showToast) {
      window.showToast(`💣 ${p.name} 引爆全场 EMP！所有对手操控反转 3.5 秒！`, 2000);
    }
  }

  function updateMissiles() {
    for (let i = TRON_STATE.missiles.length - 1; i >= 0; i--) {
      const m = TRON_STATE.missiles[i];

      // 喷射尾烟粒子
      if (Math.random() < 0.75) {
        TRON_STATE.particles.push({
          x: (m.x + 0.5) * (canvas.width / GRID_W),
          y: (m.y + 0.5) * (canvas.height / GRID_H),
          vx: (Math.random() - 0.5) * 2 - m.vx * 0.25,
          vy: (Math.random() - 0.5) * 2 - m.vy * 0.25,
          color: '#fb923c',
          size: Math.random() * 3 + 1.5,
          life: 0.6,
          decay: 0.05
        });
      }

      // 连续步进碰撞检测 (Continuous Collision Detection / Raymarching)
      // 避免单帧位移 (1.6格) 跃过 1 格厚的激光墙 (Tunneling Bug)
      const moveDist = Math.hypot(m.vx, m.vy);
      const subSteps = Math.max(1, Math.ceil(moveDist / 0.4));
      const subDx = m.vx / subSteps;
      const subDy = m.vy / subSteps;

      let exploded = false;
      for (let s = 0; s < subSteps; s++) {
        m.x += subDx;
        m.y += subDy;

        const gx = Math.round(m.x);
        const gy = Math.round(m.y);

        let hitObstacle = false;
        // 撞外墙边界
        if (gx <= 0 || gx >= GRID_W - 1 || gy <= 0 || gy >= GRID_H - 1) {
          hitObstacle = true;
        } else {
          // 撞光轨
          const cell = getCell(gx, gy);
          if (cell > 0) {
            hitObstacle = true;
          }
        }

        if (hitObstacle) {
          explodeMissile(m, gx, gy);
          TRON_STATE.missiles.splice(i, 1);
          exploded = true;
          break;
        }
      }
      if (exploded) continue;
    }
  }

  function explodeMissile(m, cx, cy) {
    if (window.AUDIO) {
      window.AUDIO.play('tron_missile_hit');
    }
    TRON_STATE.shakeFrames = 12;

    const cw = canvas.width;
    const ch = canvas.height;
    const cellW = cw / GRID_W;
    const cellH = ch / GRID_H;
    const px = (cx + 0.5) * cellW;
    const py = (cy + 0.5) * cellH;

    // 爆炸火花飞溅
    for (let j = 0; j < 35; j++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      TRON_STATE.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: j % 2 === 0 ? '#f97316' : '#38bdf8',
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.03
      });
    }

    // 炸碎半径 2.6 格内的光轨
    const blastRadius = 2.6;
    const blastRadiusSq = blastRadius * blastRadius;
    const rInt = Math.ceil(blastRadius);
    const clearedSet = new Set();

    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        if (dx * dx + dy * dy <= blastRadiusSq) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx > 0 && tx < GRID_W - 1 && ty > 0 && ty < GRID_H - 1) {
            const currentCell = getCell(tx, ty);
            if (currentCell > 0 && currentCell !== 255) {
              setCell(tx, ty, 0);
              clearedSet.add(ty * GRID_W + tx);
            }
          }
        }
      }
    }

    if (clearedSet.size > 0) {
      players.forEach(p => {
        p.trail = p.trail.filter(pt => !clearedSet.has(pt.y * GRID_W + pt.x));
      });
    }

    // 炸碎爆炸范围内的道具箱
    TRON_STATE.mysteryBoxes = TRON_STATE.mysteryBoxes.filter(box => {
      const distSq = (box.x - cx) ** 2 + (box.y - cy) ** 2;
      return distSq > blastRadiusSq;
    });

    // 检查是否有对手车头在爆炸震中
    let hitAny = false;
    players.forEach(other => {
      if (other.active && other.alive && other.id !== m.ownerId) {
        const dist = Math.hypot(other.x - cx, other.y - cy);
        if (dist <= 1.8 && !other.isGhost) {
          handlePlayerCrash(other, true);
          hitAny = true;
        }
      }
    });

    if (hitAny) {
      checkRoundEnd();
    }
  }

  // ==========================================================================
  // 60FPS 运动更新与碰撞检测 (Fixed Step & Smooth Lerp)
  // ==========================================================================

  function updateGame() {
    if (TRON_STATE.phase !== 'PLAYING') return;

    // 定期刷新神秘道具箱
    TRON_STATE.boxSpawnTimer++;
    if (TRON_STATE.boxSpawnTimer >= BOX_SPAWN_INTERVAL_FRAMES) {
      TRON_STATE.boxSpawnTimer = 0;
      spawnMysteryBox();
    }

    // 更新飞弹
    updateMissiles();

    // 更新 EMP 震撼波
    for (let i = TRON_STATE.shockwaves.length - 1; i >= 0; i--) {
      const sw = TRON_STATE.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.12 + 4;
      sw.life -= sw.decay;
      if (sw.life <= 0 || sw.radius >= sw.maxRadius) {
        TRON_STATE.shockwaves.splice(i, 1);
      }
    }

    // 更新 CRT 抖动计时
    if (TRON_STATE.crtGlitchTimer > 0) {
      TRON_STATE.crtGlitchTimer--;
    }

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

      if (p.superBoosting) {
        p.superBoostTimer--;
        if (p.superBoostTimer <= 0) {
          p.superBoosting = false;
          updateHUD();
        }
      }

      if (p.isGhost) {
        p.ghostTimer--;
        if (p.ghostTimer <= 0) {
          p.isGhost = false;
          updateHUD();
        }
      }

      if (p.empTimer > 0) {
        p.empTimer--;
        if (p.empTimer <= 0) {
          updateHUD();
        }
      }

      if (p.itemDisplayTimer > 0) {
        p.itemDisplayTimer--;
        if (p.itemDisplayTimer <= 0) {
          p.lastItemName = null;
          updateHUD();
        }
      }

      const stepInterval = p.superBoosting ? SUPER_BOOST_STEP_INTERVAL : (p.boosting ? BOOST_STEP_INTERVAL : BASE_STEP_INTERVAL);
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

    // 动态 HUD 倒计时节流刷新 (约 10Hz，每 6 帧刷新一次活动倒计时)
    TRON_STATE.hudThrottleTimer = (TRON_STATE.hudThrottleTimer || 0) + 1;
    if (TRON_STATE.hudThrottleTimer % 6 === 0) {
      const hasActiveCountdown = players.some(p => p.active && p.alive && (p.empTimer > 0 || p.ghostTimer > 0 || p.superBoostTimer > 0));
      if (hasActiveCountdown) {
        updateHUD();
      }
    }

    if (advancingPlayers.length > 0) {
      // 3. 步进物理与碰撞判定 (首要解决迎头同入一格、对穿对撞以及速度差迎头对撞)
      // 3.1 两人同时意图进入同一目标格，或迎头对穿对撞
      for (let i = 0; i < advancingPlayers.length; i++) {
        for (let j = i + 1; j < advancingPlayers.length; j++) {
          const p1 = advancingPlayers[i];
          const p2 = advancingPlayers[j];
          const isSameTarget = (p1.targetX === p2.targetX && p1.targetY === p2.targetY);
          const isHeadOnSwap = (p1.targetX === p2.prevX && p1.targetY === p2.prevY && p2.targetX === p1.prevX && p2.targetY === p1.prevY);

          if (isSameTarget || isHeadOnSwap) {
            if (p1.isGhost && p2.isGhost) {
              // 双方都是幽灵，虚无穿透，皆不死
            } else if (p1.isGhost) {
              p2.crashedThisStep = true;
            } else if (p2.isGhost) {
              p1.crashedThisStep = true;
            } else {
              p1.crashedThisStep = true;
              p2.crashedThisStep = true;
            }
          }
        }
      }

      // 3.1b 跨步进速度差迎头正面相撞：步进玩家直冲向未步进对手车头且双方朝向正对面
      advancingPlayers.forEach(p1 => {
        players.forEach(p2 => {
          if (p2.id === p1.id || !p2.active || !p2.alive) return;
          if (advancingPlayers.includes(p2)) return; // 双方都在本物理帧步进的已在 3.1 处理

          if (p1.targetX === p2.x && p1.targetY === p2.y) {
            const isHeadOn = (p2.dir.x === -p1.dir.x && p2.dir.y === -p1.dir.y);
            if (isHeadOn) {
              if (p1.isGhost && p2.isGhost) {
                // 幽灵相互穿透
              } else if (p1.isGhost) {
                p2.crashedThisStep = true;
              } else if (p2.isGhost) {
                p1.crashedThisStep = true;
              } else {
                p1.crashedThisStep = true;
                p2.crashedThisStep = true;
              }
            }
          }
        });
      });

      // 3.2 撞击外围光壁或既有光轨
      advancingPlayers.forEach(p => {
        if (p.crashedThisStep) return;

        // 撞外墙检测 (幽灵也无法穿出赛场边界，防止越界 bug)
        if (p.targetX < 0 || p.targetX >= GRID_W || p.targetY < 0 || p.targetY >= GRID_H) {
          p.crashedThisStep = true;
          return;
        }

        // 撞存留光轨检测
        const cell = getCell(p.targetX, p.targetY);
        if (cell > 0) {
          if (!p.isGhost) {
            p.crashedThisStep = true;
          }
        }
      });

      // 3.3 批量结算所有撞击出局 (先统一标记阵亡，再评估胜负，彻底消除同归于尽先撞者送胜的竞态Bug)
      let roundNeedsEndCheck = false;
      players.forEach(p => {
        if (p.active && p.alive && p.crashedThisStep) {
          handlePlayerCrash(p, true);
          roundNeedsEndCheck = true;
        }
      });

      // 3.4 幸存步进玩家提交新坐标与光轨
      advancingPlayers.forEach(p => {
        if (p.alive) {
          p.x = p.targetX;
          p.y = p.targetY;
          setCell(p.x, p.y, p.id);
          p.trail.push({ x: p.x, y: p.y });
        }
      });

      // 3.5 检查道具箱拾取
      checkMysteryBoxPickups();

      // 3.6 集中判定回合胜负
      if (roundNeedsEndCheck) {
        checkRoundEnd();
      }
    }

    // 4. 过载与超频喷气尾焰粒子
    players.forEach(p => {
      if (p.active && p.alive && (p.boosting || p.superBoosting)) {
        if (Math.random() < (p.superBoosting ? 0.95 : 0.65)) {
          spawnJetParticles(p.x, p.y, p.superBoosting ? '#fbbf24' : p.color);
        }
      }
    });
  }

  // ==========================================================================
  // 智能 Flood-Fill 连通域决策模型 (AI Heuristics & 道具争夺)
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

    // 寻找最近的神秘道具箱 (用于诱导 AI 积极争夺道具)
    let closestBox = null;
    let minBoxDist = Infinity;
    if (TRON_STATE.mysteryBoxes.length > 0) {
      TRON_STATE.mysteryBoxes.forEach(b => {
        const d = Math.abs(b.x - ai.x) + Math.abs(b.y - ai.y);
        if (d < minBoxDist) {
          minBoxDist = d;
          closestBox = b;
        }
      });
    }

    candidates.forEach(c => {
      const nx = ai.x + c.dir.x;
      const ny = ai.y + c.dir.y;

      // 撞外墙直接淘汰 (幽灵也必须在场内)
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
        return;
      }

      // 撞光轨判定：若为幽灵则不淘汰
      if (!ai.isGhost && getCell(nx, ny) > 0) {
        return;
      }

      // BFS 泛洪填充评估连通空旷度 (最多探测 160 格)
      const space = calculateFloodFillSpace(nx, ny, 160);

      // 直行有轻微倾向奖励，避免频繁无意义急转
      let score = space;
      if (c.type === 'straight') score += 5;

      // 道具箱奖励权重：如果靠近道具箱且路径安全，给予加分
      if (closestBox && minBoxDist < 25) {
        const newDist = Math.abs(closestBox.x - nx) + Math.abs(closestBox.y - ny);
        if (newDist < minBoxDist) {
          score += 20; // 积极抢道具
        }
      }

      // 避开非幽灵状态下的迎头相撞威胁
      const isRisky = players.some(other => {
        if (!other.active || !other.alive || other.id === ai.id) return false;
        const dist = Math.abs(other.x - nx) + Math.abs(other.y - ny);
        if (other.isGhost && !ai.isGhost && dist <= 3) return true;
        return dist <= 2;
      });
      if (isRisky) score -= 25;

      if (score > bestScore) {
        bestScore = score;
        chosenDir = c.dir;
      }
    });

    // 如果 AI 受到 EMP 干扰，有 45% 的概率发生操控紊乱失误
    if (ai.empTimer > 0 && Math.random() < 0.45) {
      const safeCandidates = candidates.filter(c => {
        const nx = ai.x + c.dir.x;
        const ny = ai.y + c.dir.y;
        return nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && (ai.isGhost || getCell(nx, ny) === 0);
      });
      if (safeCandidates.length > 1) {
        const alt = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
        chosenDir = alt.dir;
      }
    }

    if (chosenDir.x !== ai.dir.x || chosenDir.y !== ai.dir.y) {
      changePlayerDir(ai, chosenDir);
    }

    // 智能过载决策：空间开阔且有封路机会或紧急逃生
    if (ai.hasBoost && !ai.boosting && !ai.superBoosting) {
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
  // 输入与方向控制 (含 EMP 操控反转)
  // ==========================================================================

  function changePlayerDir(p, newDir) {
    if (!p.alive || TRON_STATE.phase !== 'PLAYING') return;

    // EMP 操控反转处理
    let effectiveDir = newDir;
    if (p.empTimer > 0) {
      effectiveDir = { x: -newDir.x, y: -newDir.y };
    }

    // 禁止 180° 自杀掉头
    if (effectiveDir.x === -p.dir.x && effectiveDir.y === -p.dir.y) return;
    if (effectiveDir.x === p.dir.x && effectiveDir.y === p.dir.y) return;

    p.nextDir = { ...effectiveDir };
    if (!p.isAi && window.AUDIO) {
      window.AUDIO.play('tron_turn');
    }
  }

  function triggerPlayerBoost(p) {
    if (!p.alive || !p.hasBoost || p.boosting || p.superBoosting || TRON_STATE.phase !== 'PLAYING') return;
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
      newDir = { x: p.dir.y, y: -p.dir.x };
    } else {
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

  function spawnPickupSparks(gx, gy, color) {
    const cw = canvas.width;
    const ch = canvas.height;
    const px = (gx + 0.5) * (cw / GRID_W);
    const py = (gy + 0.5) * (ch / GRID_H);

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      TRON_STATE.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? '#38bdf8' : (color || '#fbbf24'),
        size: Math.random() * 3 + 1.5,
        life: 0.8,
        decay: 0.04
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
        color: color || '#fbbf24',
        size: Math.random() * 2.5 + 1.5,
        life: 0.8,
        decay: 0.06
      });
    }
  }

  function spawnFloatingText(gx, gy, text, color) {
    const cw = canvas.width;
    const ch = canvas.height;
    const px = (gx + 0.5) * (cw / GRID_W);
    const py = (gy + 0.5) * (ch / GRID_H);

    TRON_STATE.floatingTexts.push({
      text,
      color,
      x: px,
      y: py,
      life: 1.0,
      decay: 0.02
    });
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
  // Canvas 2D 霓虹与道具发光渲染管线
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

    // 3. 渲染神秘道具箱 (Mystery Boxes)
    TRON_STATE.mysteryBoxes.forEach(box => {
      const bx = (box.x + 0.5) * cellW;
      const by = (box.y + 0.5) * cellH;
      const bob = Math.sin((performance.now() * 0.005) + box.hoverOffset) * (cellH * 0.25);
      const drawY = by + bob;

      ctx.save();
      ctx.translate(bx, drawY);

      // 外层霓虹发光环
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;

      const size = Math.min(cellW, cellH) * 0.95;
      // 旋转钻石框
      ctx.save();
      ctx.rotate(Math.PI / 4 + Math.sin(performance.now() * 0.002) * 0.2);
      ctx.strokeRect(-size * 0.45, -size * 0.45, size * 0.9, size * 0.9);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fillRect(-size * 0.45, -size * 0.45, size * 0.9, size * 0.9);
      ctx.restore();

      // 中心闪亮问号
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.font = `bold ${Math.floor(size * 0.8)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);

      ctx.restore();
    });

    // 4. 绘制玩家光轨 (Light Wall Trails)
    players.forEach(p => {
      if (!p.active || p.trail.length === 0) return;

      ctx.save();
      if (p.isGhost) {
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(performance.now() * 0.01);
      }
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

        if (i === 0) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy);
        } else {
          const prev = p.trail[i - 1];
          const isAdjacent = (Math.abs(pt.x - prev.x) + Math.abs(pt.y - prev.y) === 1);
          if (isAdjacent) {
            ctx.lineTo(cx, cy);
          } else {
            // 遭遇飞弹爆破形成的断口空隙，重开新子路径，绝不虚空横跨断口
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy);
          }
        }
      }

      // 如果存活且车头与最后光轨点紧密相邻，平滑连线至当前插值车头位置
      if (p.alive && p.trail.length > 0) {
        const lastPt = p.trail[p.trail.length - 1];
        const headAdjacent = (Math.abs(p.x - lastPt.x) + Math.abs(p.y - lastPt.y) <= 1);
        if (headAdjacent) {
          const headInterpX = (p.prevX + (p.x - p.prevX) * p.stepProgress + 0.5) * cellW;
          const headInterpY = (p.prevY + (p.y - p.prevY) * p.stepProgress + 0.5) * cellH;
          ctx.lineTo(headInterpX, headInterpY);
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    // 5. 渲染破墙飞弹 (Missiles)
    TRON_STATE.missiles.forEach(m => {
      const mx = (m.x + 0.5) * cellW;
      const my = (m.y + 0.5) * cellH;

      ctx.save();
      ctx.translate(mx, my);
      const angle = Math.atan2(m.vy, m.vx);
      ctx.rotate(angle);

      // 尾焰
      const jetGrad = ctx.createLinearGradient(-cellW * 0.8, 0, 0, 0);
      jetGrad.addColorStop(0, 'transparent');
      jetGrad.addColorStop(1, '#f97316');
      ctx.fillStyle = jetGrad;
      ctx.fillRect(-cellW * 0.8, -cellH * 0.15, cellW * 0.8, cellH * 0.3);

      // 飞弹弹体
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 10;
      ctx.fillRect(-cellW * 0.3, -cellH * 0.2, cellW * 0.6, cellH * 0.4);

      // 弹头
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(cellW * 0.3, -cellH * 0.2);
      ctx.lineTo(cellW * 0.55, 0);
      ctx.lineTo(cellW * 0.3, cellH * 0.2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });

    // 6. 绘制光轮摩托车头 (Bike Heads & Headlights)
    players.forEach(p => {
      if (!p.active || !p.alive) return;

      const curX = (p.prevX + (p.x - p.prevX) * p.stepProgress + 0.5) * cellW;
      const curY = (p.prevY + (p.y - p.prevY) * p.stepProgress + 0.5) * cellH;

      ctx.save();
      ctx.translate(curX, curY);

      if (p.isGhost) {
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(performance.now() * 0.015);
      }

      // 计算车头旋转角度
      const angle = Math.atan2(p.dir.y, p.dir.x);
      ctx.rotate(angle);

      // 前照大灯光束 (Cone Light)
      const grad = ctx.createRadialGradient(0, 0, 2, 28, 0, 36);
      grad.addColorStop(0, p.isGhost ? 'rgba(192, 132, 252, 0.9)' : p.glowColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 36, -Math.PI / 5, Math.PI / 5);
      ctx.closePath();
      ctx.fill();

      // 车头机体
      ctx.shadowColor = p.isGhost ? '#c084fc' : p.glowColor;
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-cellW * 0.45, -cellH * 0.35, cellW * 0.9, cellH * 0.7);

      ctx.fillStyle = p.isGhost ? '#a855f7' : p.color;
      ctx.fillRect(-cellW * 0.25, -cellH * 0.2, cellW * 0.6, cellH * 0.4);

      // 基础过载光环
      if (p.boosting && !p.superBoosting) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, cellW * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 超频暴走金色闪电光环
      if (p.superBoosting) {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, cellW * 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }

      // EMP 电流瘫痪状态指示
      if (p.empTimer > 0) {
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, cellW * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    // 7. 渲染 EMP 震撼波扩展环
    TRON_STATE.shockwaves.forEach(sw => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sw.life);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 16;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 8. 渲染碎裂火花粒子
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

    // 9. 渲染浮动提示文字 (Floating Texts)
    for (let i = TRON_STATE.floatingTexts.length - 1; i >= 0; i--) {
      const ft = TRON_STATE.floatingTexts[i];
      ft.y -= 0.6;
      ft.life -= ft.decay;
      if (ft.life <= 0) {
        TRON_STATE.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 10. CRT Glitch EMP 扫频线
    if (TRON_STATE.crtGlitchTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 2;
      for (let y = 0; y < ch; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }
      ctx.restore();
    }

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
      const itemSlotEl = document.getElementById(`tron-item-slot-p${p.id}`);
      const itemIconEl = document.getElementById(`tron-item-icon-p${p.id}`);
      const itemTextEl = document.getElementById(`tron-item-text-p${p.id}`);
      const touchPad = document.getElementById(`touch-pad-p${p.id}`);
      const hintRow = document.getElementById(`hint-p${p.id}`);

      if (card) {
        card.style.display = p.active ? 'flex' : 'none';
        card.classList.toggle('dead', !p.alive);
        card.classList.toggle('emp-shocked', p.alive && p.empTimer > 0);
        card.classList.toggle('ghost-mode', p.alive && p.isGhost);
        card.classList.toggle('super-boost', p.alive && p.superBoosting);
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

      if (itemSlotEl && itemTextEl && itemIconEl) {
        itemSlotEl.className = 'tron-item-slot';
        if (!p.alive) {
          itemIconEl.textContent = '💀';
          itemTextEl.textContent = '已出局';
        } else if (p.isGhost && p.empTimer > 0) {
          itemSlotEl.classList.add('ghost', 'emp-affected');
          itemIconEl.textContent = '👻';
          itemTextEl.textContent = `幽灵${(p.ghostTimer / 60).toFixed(1)}s ⚡反转${(p.empTimer / 60).toFixed(1)}s`;
        } else if (p.empTimer > 0) {
          itemSlotEl.classList.add('emp-affected');
          itemIconEl.textContent = '⚡';
          itemTextEl.textContent = `EMP反转 ${(p.empTimer / 60).toFixed(1)}s`;
        } else if (p.isGhost) {
          itemSlotEl.classList.add('ghost');
          itemIconEl.textContent = '👻';
          itemTextEl.textContent = `幽灵中 ${(p.ghostTimer / 60).toFixed(1)}s`;
        } else if (p.superBoosting) {
          itemSlotEl.classList.add('super-boost');
          itemIconEl.textContent = '⚡';
          itemTextEl.textContent = `超频中 ${(p.superBoostTimer / 60).toFixed(1)}s`;
        } else if (p.lastItemName && p.itemDisplayTimer > 0) {
          itemSlotEl.classList.add('missile');
          itemIconEl.textContent = p.lastItemName.includes('🚀') ? '🚀' : '💣';
          itemTextEl.textContent = p.lastItemName;
        } else {
          itemIconEl.textContent = '🎁';
          itemTextEl.textContent = '道具: 待拾取';
        }
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
        "🏍️ 极光光轮摩托 · 道具大乱斗规则与指南",
        `
          <p><strong>《马里奥赛车式：道具大乱斗》重磅升级：</strong>每位玩家驾驶超速光轮摩托，不仅身后拖曳实体激光死斗墙，赛场上更会随机刷新<strong>【神秘道具箱】</strong>！</p><br>
          <p><strong>🎁 4 大神秘道具拾取即时生效：</strong></p>
          <ul>
            <li>🚀 <b>破墙飞弹 (Missile)：</b>向前射出超音速激光飞弹，炸碎前方大范围光轨光墙，绝境炸出生路！若直击对手更可造成致命破坏！</li>
            <li>👻 <b>穿墙幽灵 (Ghost / Phase)：</b>身体虚化 3 秒，免疫任何光轨撞击，直接穿越对手或自己的光壁绝地突围反杀！</li>
            <li>⚡ <b>超频氮气 (Super Boost)：</b>200% 极速狂飙，以暴走速度漂移甩尾封死对手所有退路！</li>
            <li>💣 <b>EMP 震撼波 (EMP Shockwave)：</b>释放全场电磁脉冲，让其他所有对手的方向操控瞬间反转 3.5 秒！</li>
          </ul><br>
          <p><strong>⚡ 基础应急过载 (Overdrive)：</strong></p>
          <ul>
            <li>每回合每人仍保有 <b>1 次</b> 基础过载加速保底机会！</li>
          </ul><br>
          <p><strong>🎮 PC 键位完全独立无冲突：</strong></p>
          <ul>
            <li><b>🔴 P1 (红方)：</b> <b>WASD</b> 转向，<b>Q</b> 基础过载</li>
            <li><b>🟢 P2 (绿方)：</b> <b>方向键 ↑↓←→</b> 转向，<b>Enter / M</b> 基础过载</li>
            <li><b>🔵 P3 (蓝方)：</b> <b>IJKL</b> 转向，<b>U</b> 基础过载</li>
            <li><b>🟡 P4 (黄方)：</b> <b>小键盘 8456 / TFGH</b> 转向，<b>R</b> 基础过载</li>
            <li><b>📱 触控端：</b> 屏幕提供左转 ↶ / 右转 ↷ 相对转向与 ⚡ 过载按键（EMP下自动智能反转）！</li>
          </ul><br>
          <p><strong>🏆 胜负判定：</strong>坚持到最后的唯一幸存者斩获 1 胜，率先达成 3 胜或 5 胜荣膺终极总冠军！</p>
        `,
        resetCurrentGame
      );
    }

    // 启动 60FPS 渲染物理循环
    TRON_STATE.animId = requestAnimationFrame(gameLoop);
  });

})();
