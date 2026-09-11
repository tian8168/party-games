    // ==========================================================================
    // 12. 魂斗罗 (CONTRA: 丛林突袭·无限远征) 核心物理与无限生成引擎
    // ==========================================================================
    function initContraGame() {
      STATE.contra.lives = 3;
      STATE.contra.weapon = 'NORMAL'; // 'NORMAL', 'S', 'M', 'L', 'F', 'C'
      STATE.contra.shield = 0;        // 能量护盾剩余层数 (0~3)
      STATE.contra.hasDrone = false;  // 战术僚机
      STATE.contra.droneAngle = 0;
      STATE.contra.hasBoots = false;  // 极速战靴
      STATE.contra.bossCount = 0;     // 已消灭 BOSS 数
      STATE.contra.score = 0;
      STATE.contra.cameraX = 0;
      STATE.contra.distance = 0;      // 行进米数

      // 无限地图流式生成器状态
      STATE.contra.genX = -100;
      STATE.contra.nextBossX = 1400;  // 首个 BOSS 出现位置
      STATE.contra.bossActive = false;
      STATE.contra.bossLockX = null;  // BOSS 战锁定的镜头位置
      STATE.contra.bossArenaX = null; // BOSS 战竞技场基准坐标
      STATE.contra.boss = null;
      STATE.contra.bossAlertTimer = 0;
      STATE.contra.screenShake = 0;

      STATE.contra.platforms = [];
      STATE.contra.enemies = [];
      STATE.contra.capsules = [];
      STATE.contra.pickups = [];
      STATE.contra.bullets = [];
      STATE.contra.enemyBullets = [];
      STATE.contra.particles = [];

      resizeContraCanvas();
      buildInitialContraMap();
      resetContraPlayer();
      setupContraInputs();
      updateContraHUD();
      startContraLoop();
    }

    function resizeContraCanvas() {
      const c = document.getElementById('contra-canvas');
      if (!c) return;
      const stage = document.getElementById('contra-stage');
      const w = (stage && stage.clientWidth > 50) ? stage.clientWidth : (c.parentElement && c.parentElement.clientWidth > 50 ? c.parentElement.clientWidth : 480);
      c.width = w;
      c.height = window.innerWidth <= 480 ? 240 : 310;
    }

    // --- 1. 无限地图流式生成系统 ---
    function buildInitialContraMap() {
      const H = window.innerWidth <= 480 ? 240 : 310;
      STATE.contra.genX = -100;

      // 初始安全出生地与起步跑道
      STATE.contra.platforms.push(
        { x: -100, y: H - 40, w: 620, h: 40, ground: true },
        { x: 200, y: H - 110, w: 180, h: 14, ground: false },
        { x: 320, y: H - 175, w: 160, h: 14, ground: false }
      );

      // 初始小兵与第一个武器胶囊
      STATE.contra.enemies.push(
        { type: 'runner', x: 380, y: H - 75, vx: -1.2, hp: 1 },
        { type: 'runner', x: 540, y: H - 75, vx: -1.2, hp: 1 }
      );
      STATE.contra.capsules.push(
        { x: 240, y: 75, vx: 1.8, t: 0, type: 'S', alive: true }
      );

      STATE.contra.genX = 520;
      updateMapStream();
    }

    function updateMapStream() {
      const c = document.getElementById('contra-canvas');
      const cW = c ? c.width : 480;
      const H = c ? c.height : 310;
      const lookAhead = STATE.contra.cameraX + cW + 900;

      while (STATE.contra.genX < lookAhead) {
        // 判断是否到达 BOSS 生成节点
        if (STATE.contra.genX >= STATE.contra.nextBossX && !STATE.contra.boss) {
          generateBossArena(H);
        } else {
          generateRandomWildernessSegment(H);
        }
      }
    }

    function generateBossArena(H) {
      const c = document.getElementById('contra-canvas');
      const cW = c ? c.width : 480;
      const arenaX = STATE.contra.genX;
      const arenaWidth = Math.max(720, cW + 220);

      STATE.contra.bossArenaX = arenaX;

      // BOSS 战专属决斗平地擂台 (前后重叠延伸，杜绝断崖悬空)
      STATE.contra.platforms.push(
        { x: arenaX - 120, y: H - 40, w: arenaWidth + 240, h: 40, ground: true, isArena: true },
        { x: arenaX + 50, y: H - 100, w: 120, h: 14, ground: false },
        { x: arenaX + 160, y: H - 160, w: 120, h: 14, ground: false }
      );

      // 实例化随机 BOSS (确保位于视口锁定时右侧)
      spawnRandomBoss(arenaX, H, cW);
      STATE.contra.genX += arenaWidth;
    }

    function generateRandomWildernessSegment(H) {
      const startX = STATE.contra.genX;
      const segmentTypes = ['JUNGLE_HILLS', 'CANYON_BRIDGES', 'OUTPOST_BARRICADE', 'FLOATING_RUINS'];
      const type = segmentTypes[Math.floor(Math.random() * segmentTypes.length)];
      let segLength = 480 + Math.floor(Math.random() * 160);

      const lvl = Math.min(6, 1 + Math.floor(startX / 2500));

      if (type === 'JUNGLE_HILLS') {
        // 丛林地表 + 悬空跳板
        const gap = Math.random() < 0.35 ? 70 : 0;
        const w1 = Math.floor((segLength - gap) * 0.55);
        const w2 = segLength - gap - w1;

        STATE.contra.platforms.push(
          { x: startX, y: H - 40, w: w1, h: 40, ground: true },
          { x: startX + 120, y: H - 110, w: 150, h: 14, ground: false }
        );
        if (gap > 0) {
          STATE.contra.platforms.push(
            { x: startX + w1 + gap, y: H - 40, w: w2, h: 40, ground: true },
            { x: startX + w1 - 20, y: H - 130, w: 110, h: 14, ground: false }
          );
        } else {
          STATE.contra.platforms.push(
            { x: startX + w1, y: H - 40, w: w2, h: 40, ground: true },
            { x: startX + 280, y: H - 170, w: 140, h: 14, ground: false }
          );
        }

        // 刷新敌兵
        STATE.contra.enemies.push(
          { type: 'runner', x: startX + 320, y: H - 75, vx: -(1.2 + lvl * 0.1), hp: 1 },
          { type: 'sniper', x: startX + 180, y: H - 130, shootTimer: 80 - lvl * 5, hp: 2 }
        );
      } else if (type === 'CANYON_BRIDGES') {
        // 悬空多层钢架断桥
        STATE.contra.platforms.push(
          { x: startX, y: H - 40, w: 140, h: 40, ground: true },
          { x: startX + 110, y: H - 100, w: 150, h: 14, ground: false },
          { x: startX + 240, y: H - 160, w: 150, h: 14, ground: false },
          { x: startX + 360, y: H - 110, w: 140, h: 14, ground: false },
          { x: startX + segLength - 120, y: H - 40, w: 120, h: 40, ground: true }
        );

        STATE.contra.enemies.push(
          { type: 'sniper', x: startX + 300, y: H - 180, shootTimer: 70 - lvl * 5, hp: 2 },
          { type: 'turret', x: startX + 410, y: H - 130, angle: Math.PI, shootTimer: 90 - lvl * 6, hp: 3 }
        );
      } else if (type === 'OUTPOST_BARRICADE') {
        // 要塞外围防御工事
        STATE.contra.platforms.push(
          { x: startX, y: H - 40, w: segLength, h: 40, ground: true },
          { x: startX + 90, y: H - 110, w: 170, h: 14, ground: false },
          { x: startX + 230, y: H - 180, w: 160, h: 14, ground: false }
        );

        STATE.contra.enemies.push(
          { type: 'runner', x: startX + 280, y: H - 75, vx: -(1.3 + lvl * 0.1), hp: 1 },
          { type: 'runner', x: startX + 420, y: H - 75, vx: -(1.4 + lvl * 0.1), hp: 1 },
          { type: 'turret', x: startX + 320, y: H - 75, angle: Math.PI, shootTimer: 85 - lvl * 5, hp: 4 }
        );
      } else {
        // FLOATING_RUINS 阶梯悬浮石阶
        STATE.contra.platforms.push(
          { x: startX, y: H - 40, w: 180, h: 40, ground: true },
          { x: startX + 150, y: H - 90, w: 130, h: 14, ground: false },
          { x: startX + 260, y: H - 150, w: 140, h: 14, ground: false },
          { x: startX + 380, y: H - 90, w: 130, h: 14, ground: false },
          { x: startX + segLength - 160, y: H - 40, w: 160, h: 40, ground: true }
        );

        STATE.contra.enemies.push(
          { type: 'runner', x: startX + 350, y: H - 75, vx: -(1.2 + lvl * 0.1), hp: 1 },
          { type: 'sniper', x: startX + 320, y: H - 170, shootTimer: 75 - lvl * 5, hp: 2 }
        );
      }

      // 飞行胶囊刷新概率 (40%)
      if (Math.random() < 0.45) {
        const weaponPool = ['S', 'M', 'L', 'F', 'C'];
        const wType = weaponPool[Math.floor(Math.random() * weaponPool.length)];
        STATE.contra.capsules.push({
          x: startX + 120,
          y: 65 + Math.random() * 25,
          vx: 1.8,
          t: Math.random() * 5,
          type: wType,
          alive: true
        });
      }

      STATE.contra.genX += segLength;
    }

    // --- 2. 随机多形态 BOSS 生成器 ---
    function spawnRandomBoss(arenaX, H, cW, overrideType) {
      const lvl = STATE.contra.bossCount + 1;
      const types = ['core', 'mech', 'alien'];
      const chosenType = overrideType || types[Math.floor(Math.random() * types.length)];
      if (!cW) cW = 480;

      let bossObj = null;

      if (chosenType === 'core') {
        // 要塞感应核心 BOSS (固定在视口右侧)
        const maxHp = 50 + lvl * 22;
        const w = 120;
        const h = 150;
        bossObj = {
          type: 'core',
          name: `要塞异形核心 Lv.${lvl}`,
          x: arenaX + cW - w - 20,
          y: H - 190,
          w: w,
          h: h,
          hp: maxHp,
          maxHp: maxHp,
          leftTurretHp: 18 + lvl * 6,
          rightTurretHp: 18 + lvl * 6,
          shootTimer: 0,
          defeated: false
        };
      } else if (chosenType === 'mech') {
        // 巨型重装步行机甲 BOSS (在擂台右半区域巡逻)
        const maxHp = 60 + lvl * 25;
        const w = 110;
        const h = 135;
        const maxX = arenaX + cW - w - 20;
        const minX = arenaX + 150;
        bossObj = {
          type: 'mech',
          name: `巨型重装机甲 Lv.${lvl}`,
          x: maxX,
          y: H - 175,
          w: w,
          h: h,
          hp: maxHp,
          maxHp: maxHp,
          vx: -1.0,
          minX: minX,
          maxX: maxX,
          shootTimer: 0,
          walkAnim: 0,
          defeated: false
        };
      } else {
        // 异形浮空战舰 BOSS (在右上方优雅巡弋浮动)
        const maxHp = 50 + lvl * 20;
        const w = 130;
        const h = 90;
        bossObj = {
          type: 'alien',
          name: `异形浮空战舰 Lv.${lvl}`,
          x: arenaX + cW - w - 25,
          baseY: H - 200,
          y: H - 200,
          w: w,
          h: h,
          hp: maxHp,
          maxHp: maxHp,
          floatT: 0,
          shootTimer: 0,
          defeated: false
        };
      }

      STATE.contra.boss = bossObj;
    }

    function resetContraPlayer() {
      const H = window.innerWidth <= 480 ? 240 : 310;
      const p = STATE.contra.player;
      p.x = Math.max(50, STATE.contra.cameraX + 40);
      p.y = H - 40 - 18;
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.facing = 1;
      p.crouch = false;
      p.aimUp = false;
      p.jumpAngle = 0;
      p.invincibleTime = 120; // 2秒无敌保护
    }

    function updateContraHUD() {
      const lifeDisplay = document.getElementById('contra-life-display');
      if (lifeDisplay) {
        const dist = Math.floor(STATE.contra.player.x / 10);
        lifeDisplay.textContent = `🔴 ${STATE.contra.lives}命 | 🚩${dist}m | 👑${STATE.contra.bossCount}`;
      }

      const weaponMap = {
        'NORMAL': 'GUN:[普通]',
        'S': 'GUN:[🔴S散弹]',
        'M': 'GUN:[🟡M机枪]',
        'L': 'GUN:[🔵L激光]',
        'F': 'GUN:[🟣F烈焰]',
        'C': 'GUN:[🟢C追踪]'
      };

      const gearIcons = [];
      if (STATE.contra.shield > 0) gearIcons.push(`🛡️×${STATE.contra.shield}`);
      if (STATE.contra.hasDrone) gearIcons.push(`🛸僚机`);
      if (STATE.contra.hasBoots) gearIcons.push(`⚡战靴`);

      const gearStr = gearIcons.length > 0 ? ` ${gearIcons.join(' ')}` : '';
      const weaponDisplay = document.getElementById('contra-weapon-display');
      if (weaponDisplay) {
        weaponDisplay.textContent = (weaponMap[STATE.contra.weapon] || 'GUN:[普通]') + gearStr;
      }
    }

    function activateKonami30Lives() {
      AUDIO.init();
      STATE.contra.lives = 30;
      AUDIO.play('contra_30');
      updateContraHUD();
      showToast('⚡【上上下下左右左右BA】秘籍触发！获得 30 条命！', 3000);

      // 金光粒子庆祝
      for (let i = 0; i < 30; i++) {
        STATE.contra.particles.push({
          x: STATE.contra.player.x,
          y: STATE.contra.player.y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 1.2,
          color: '#fbbf24'
        });
      }
    }

    // --- 输入监听 ---
    function setupContraInputs() {
      const keys = STATE.contra.keys;
      const konamiSeq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
      let konamiIdx = 0;

      window.onkeydown = (e) => {
        if (STATE.currentGame !== 'CONTRA') return;

        if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        if (e.code === konamiSeq[konamiIdx]) {
          konamiIdx++;
          if (konamiIdx === konamiSeq.length) {
            activateKonami30Lives();
            konamiIdx = 0;
          }
        } else {
          konamiIdx = 0;
        }

        if (['KeyA', 'ArrowLeft'].includes(e.code)) keys.left = true;
        if (['KeyD', 'ArrowRight'].includes(e.code)) keys.right = true;
        if (['KeyW', 'ArrowUp'].includes(e.code)) keys.up = true;
        if (['KeyS', 'ArrowDown'].includes(e.code)) keys.down = true;
        if (['KeyJ', 'KeyZ', 'Space'].includes(e.code)) {
          if (!keys.fire) fireContraPlayer();
          keys.fire = true;
        }
        if (['KeyK', 'KeyX'].includes(e.code)) {
          if (!keys.jump) jumpContraPlayer();
          keys.jump = true;
        }
      };

      window.onkeyup = (e) => {
        if (STATE.currentGame !== 'CONTRA') return;
        if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        if (['KeyA', 'ArrowLeft'].includes(e.code)) keys.left = false;
        if (['KeyD', 'ArrowRight'].includes(e.code)) keys.right = false;
        if (['KeyW', 'ArrowUp'].includes(e.code)) keys.up = false;
        if (['KeyS', 'ArrowDown'].includes(e.code)) keys.down = false;
        if (['KeyJ', 'KeyZ', 'Space'].includes(e.code)) keys.fire = false;
        if (['KeyK', 'KeyX'].includes(e.code)) keys.jump = false;
      };

      const bindTouch = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;
        const down = (e) => { e.preventDefault(); el.classList.add('active'); onDown(); };
        const up = (e) => { e.preventDefault(); el.classList.remove('active'); onUp(); };
        el.onmousedown = down; el.onmouseup = up; el.onmouseleave = up;
        el.ontouchstart = down; el.ontouchend = up;
        el.ontouchcancel = up;
      };

      bindTouch('btn-dpad-left',  () => { keys.left = true; }, () => { keys.left = false; });
      bindTouch('btn-dpad-right', () => { keys.right = true; }, () => { keys.right = false; });
      bindTouch('btn-dpad-up',    () => { keys.up = true; }, () => { keys.up = false; });
      bindTouch('btn-dpad-down',  () => { keys.down = true; }, () => { keys.down = false; });

      bindTouch('btn-contra-fire', () => { fireContraPlayer(); keys.fire = true; }, () => { keys.fire = false; });
      bindTouch('btn-contra-jump', () => { jumpContraPlayer(); keys.jump = true; }, () => { keys.jump = false; });

      const c = document.getElementById('contra-canvas');
      if (c && !c._pointerBound) {
        c._pointerBound = true;
        c.addEventListener('pointerdown', (e) => {
          if (STATE.currentGame !== 'CONTRA') return;
          fireContraPlayer();
        });
      }
    }

    function jumpContraPlayer() {
      AUDIO.init();
      const p = STATE.contra.player;
      if (p.onGround) {
        if (STATE.contra.keys.down) {
          // 趴下按跳穿透薄平台
          p.y += 18;
          p.onGround = false;
          p.vy = 2;
        } else {
          // 跳跃高度支持极速战靴加成
          const jumpPower = STATE.contra.hasBoots ? -10.2 : -9.0;
          p.vy = jumpPower;
          p.onGround = false;
          AUDIO.play('contra_jump');
        }
      }
    }

    // --- 3. 玩家开火系统 (支持全新 F 弹、C 追踪弹与僚机协同) ---
    function fireContraPlayer() {
      AUDIO.init();
      const p = STATE.contra.player;
      const keys = STATE.contra.keys;

      let angle = 0;
      if (p.onGround && p.crouch) {
        angle = p.facing === 1 ? 0 : Math.PI;
      } else if (keys.up && (keys.left || keys.right)) {
        angle = p.facing === 1 ? -Math.PI / 4 : -Math.PI * 3 / 4;
      } else if (keys.down && !p.onGround && (keys.left || keys.right)) {
        angle = p.facing === 1 ? Math.PI / 4 : Math.PI * 3 / 4;
      } else if (keys.up) {
        angle = -Math.PI / 2;
      } else if (keys.down && !p.onGround) {
        angle = Math.PI / 2;
      } else {
        angle = p.facing === 1 ? 0 : Math.PI;
      }

      const spawnX = p.x + (p.facing === 1 ? 14 : -14);
      const spawnY = p.crouch ? p.y + 12 : p.y - 8;
      const weapon = STATE.contra.weapon;

      if (weapon === 'NORMAL') {
        AUDIO.play('contra_shoot');
        STATE.contra.bullets.push({
          x: spawnX, y: spawnY,
          vx: Math.cos(angle) * 8.8, vy: Math.sin(angle) * 8.8,
          color: '#f8fafc', r: 3, dmg: 1
        });
      } else if (weapon === 'S') {
        // 5 向扇形散射
        AUDIO.play('contra_spread');
        const fanOffsets = [-0.35, -0.18, 0, 0.18, 0.35];
        fanOffsets.forEach(offset => {
          const a = angle + offset;
          STATE.contra.bullets.push({
            x: spawnX, y: spawnY,
            vx: Math.cos(a) * 9.0, vy: Math.sin(a) * 9.0,
            color: '#ef4444', r: 4.5, dmg: 1.2
          });
        });
      } else if (weapon === 'M') {
        // 极速重机枪
        AUDIO.play('contra_shoot');
        STATE.contra.bullets.push({
          x: spawnX, y: spawnY,
          vx: Math.cos(angle) * 10.5, vy: Math.sin(angle) * 10.5,
          color: '#fbbf24', r: 3.5, dmg: 1.1
        });
      } else if (weapon === 'L') {
        // 高能贯穿激光
        AUDIO.play('contra_shoot');
        STATE.contra.bullets.push({
          x: spawnX, y: spawnY,
          vx: Math.cos(angle) * 13, vy: Math.sin(angle) * 13,
          color: '#38bdf8', r: 5, dmg: 3.5, piercing: true
        });
      } else if (weapon === 'F') {
        // 🟣 F 弹: 烈焰螺旋弹 (双螺旋旋转火球 + 范围爆破)
        AUDIO.play('contra_spread');
        for (let sign = -1; sign <= 1; sign += 2) {
          STATE.contra.bullets.push({
            type: 'flame',
            x: spawnX, y: spawnY,
            vx: Math.cos(angle) * 7.5, vy: Math.sin(angle) * 7.5,
            orbitAngle: sign * Math.PI / 2,
            orbitSpeed: 0.25 * sign,
            color: '#ec4899', r: 6, dmg: 2.2
          });
        }
      } else if (weapon === 'C') {
        // 🟢 C 弹: 智能微型追踪飞弹
        AUDIO.play('contra_shoot');
        const count = 2;
        for (let i = 0; i < count; i++) {
          const spreadA = angle + (i === 0 ? -0.25 : 0.25);
          STATE.contra.bullets.push({
            type: 'missile',
            x: spawnX, y: spawnY,
            vx: Math.cos(spreadA) * 6.5, vy: Math.sin(spreadA) * 6.5,
            color: '#10b981', r: 4.5, dmg: 2.5,
            homingTimer: 8
          });
        }
      }

      // 战术僚机协同开火
      if (STATE.contra.hasDrone) {
        const droneX = p.x + Math.cos(STATE.contra.droneAngle) * 22;
        const droneY = p.y - 26 + Math.sin(STATE.contra.droneAngle) * 8;
        STATE.contra.bullets.push({
          x: droneX, y: droneY,
          vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10,
          color: '#60a5fa', r: 3.5, dmg: 1.2
        });
      }
    }

    // --- 4. 主循环与物理更新引擎 ---
    function startContraLoop() {
      if (STATE.contra.animId) cancelAnimationFrame(STATE.contra.animId);

      let lastTime = performance.now();
      let accumulator = 0;
      const FIXED_STEP = 1000 / 60;

      function loop(now) {
        if (STATE.currentGame === 'CONTRA') {
          try {
            if (!now) now = performance.now();
            let elapsed = now - lastTime;
            lastTime = now;
            if (elapsed > 100) elapsed = 100;
            accumulator += elapsed;

            while (accumulator >= FIXED_STEP) {
              updateContraPhysics();
              accumulator -= FIXED_STEP;
            }

            renderContra();
          } catch (err) {
            console.error('Contra loop error caught:', err);
          }
          STATE.contra.animId = requestAnimationFrame(loop);
        }
      }
      loop(performance.now());
    }

    function updateContraPhysics() {
      const p = STATE.contra.player;
      const keys = STATE.contra.keys;
      const c = document.getElementById('contra-canvas');
      const cW = c ? c.width : 480;
      const cH = c ? c.height : 310;
      const H = cH;

      // 连续开火支持
      if (keys.fire && (STATE.contra.weapon === 'M' || Math.random() < 0.12)) {
        fireContraPlayer();
      }

      // 移动速度 (极速战靴加成)
      const moveSpeed = STATE.contra.hasBoots ? 3.6 : 2.6;
      p.crouch = keys.down && p.onGround;
      if (!p.crouch) {
        if (keys.left) { p.vx = -moveSpeed; p.facing = -1; }
        else if (keys.right) { p.vx = moveSpeed; p.facing = 1; }
        else { p.vx = 0; }
      } else {
        p.vx = 0;
      }

      p.vy = Math.min(p.vy + 0.44, 11);
      p.x += p.vx;
      p.y += p.vy;

      if (!p.onGround) p.jumpAngle += 0.35 * p.facing;
      else p.jumpAngle = 0;

      if (p.invincibleTime > 0) p.invincibleTime--;

      // 僚机轨道旋转
      if (STATE.contra.hasDrone) {
        STATE.contra.droneAngle = (STATE.contra.droneAngle + 0.08) % (Math.PI * 2);
      }

      // 平台碰撞判定
      p.onGround = false;
      const pHalfW = 10;
      const pFootY = p.y + 18;

      STATE.contra.platforms.forEach(plat => {
        if (p.x + pHalfW > plat.x && p.x - pHalfW < plat.x + plat.w) {
          if (p.vy >= 0 && pFootY >= plat.y && (pFootY - p.vy <= plat.y + 16 || pFootY <= plat.y + 12)) {
            p.y = plat.y - 18;
            p.vy = 0;
            p.onGround = true;
          }
        }
      });

      // 坠坑死亡判定
      const limitY = cH + 40;
      if (p.y > limitY) {
        killContraPlayer();
      }

      // 触发 BOSS 战遭遇判定：当玩家推进进入 BOSS 竞技场
      if (STATE.contra.boss && !STATE.contra.boss.defeated && !STATE.contra.bossActive && STATE.contra.bossArenaX !== null) {
        if (p.x >= STATE.contra.bossArenaX + cW * 0.35) {
          STATE.contra.cameraX = STATE.contra.bossArenaX;
          STATE.contra.bossLockX = STATE.contra.bossArenaX;
          STATE.contra.bossActive = true;
          STATE.contra.bossAlertTimer = 180; // 3秒突袭警报特效
          AUDIO.play('contra_explode');
          showToast(`🚨 警报！已遭遇强敌【${STATE.contra.boss.name}】！全力开火！`, 4000);
        }
      }

      // 摄像机横向推进行走与 BOSS 战锁定
      if (STATE.contra.bossActive && STATE.contra.bossLockX !== null) {
        // 锁定在 BOSS 擂台内，玩家在当前屏幕范围内决战
        const lockX = STATE.contra.bossLockX;
        STATE.contra.cameraX = lockX;
        if (p.x < lockX + 16) p.x = lockX + 16;
        if (p.x > lockX + cW - 24) p.x = lockX + cW - 24;
      } else {
        // 自由无限推进
        if (p.x - STATE.contra.cameraX > cW * 0.45) {
          STATE.contra.cameraX = p.x - cW * 0.45;
        }
        if (p.x < STATE.contra.cameraX + 12) p.x = STATE.contra.cameraX + 12;
      }

      if (STATE.contra.bossAlertTimer > 0) STATE.contra.bossAlertTimer--;
      if (STATE.contra.screenShake > 0) STATE.contra.screenShake--;

      // 动态无限地图扩展更新
      updateMapStream();

      // 1. 玩家子弹更新与追踪逻辑
      STATE.contra.bullets.forEach(b => {
        if (b.type === 'missile') {
          b.homingTimer--;
          if (b.homingTimer <= 0) {
            // 索敌最近敌人或 BOSS
            let target = null;
            let minDist = 380;
            if (STATE.contra.bossActive && STATE.contra.boss && !STATE.contra.boss.defeated) {
              target = { x: STATE.contra.boss.x + STATE.contra.boss.w / 2, y: STATE.contra.boss.y + STATE.contra.boss.h / 2 };
            } else {
              STATE.contra.enemies.forEach(en => {
                const dist = Math.hypot(en.x - b.x, en.y - b.y);
                if (dist < minDist) { minDist = dist; target = en; }
              });
            }
            if (target) {
              const desiredAngle = Math.atan2(target.y - b.y, target.x - b.x);
              const curAngle = Math.atan2(b.vy, b.vx);
              let diff = desiredAngle - curAngle;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              const newAngle = curAngle + diff * 0.12;
              const spd = 7.5;
              b.vx = Math.cos(newAngle) * spd;
              b.vy = Math.sin(newAngle) * spd;
            }
          }
        }
        b.x += b.vx;
        b.y += b.vy;
      });

      // 2. 敌方子弹更新
      STATE.contra.enemyBullets.forEach(eb => {
        eb.x += eb.vx;
        eb.y += eb.vy;
        if (p.invincibleTime <= 0 && Math.hypot(eb.x - p.x, eb.y - (p.crouch ? p.y + 10 : p.y)) < 16) {
          killContraPlayer();
        }
      });

      // 3. 敌兵更新与受击检测
      STATE.contra.enemies.forEach(en => {
        if (en.type === 'runner') {
          en.x += en.vx;
          if (p.invincibleTime <= 0 && Math.hypot(en.x - p.x, en.y - p.y) < 20) {
            killContraPlayer();
          }
        } else if (en.type === 'sniper') {
          en.shootTimer--;
          if (en.shootTimer <= 0 && Math.abs(en.x - p.x) < 340) {
            en.shootTimer = 110;
            const a = Math.atan2(p.y - en.y, p.x - en.x);
            STATE.contra.enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5 });
          }
        } else if (en.type === 'turret') {
          en.shootTimer--;
          if (en.shootTimer <= 0 && Math.abs(en.x - p.x) < 300) {
            en.shootTimer = 120;
            const a = Math.atan2(p.y - en.y, p.x - en.x);
            STATE.contra.enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2 });
          }
        }

        STATE.contra.bullets.forEach(b => {
          if (Math.hypot(b.x - en.x, b.y - en.y) < 18) {
            en.hp -= b.dmg;
            if (!b.piercing) b.y = -999;
            if (en.hp <= 0) {
              AUDIO.play('contra_explode');
              STATE.contra.score += 100;
              spawnExplosion(en.x, en.y);
            }
          }
        });
      });

      // 4. 飞行武器胶囊
      STATE.contra.capsules.forEach(cap => {
        if (!cap.alive) return;
        cap.t += 0.05;
        cap.x += cap.vx;
        cap.y += Math.sin(cap.t) * 1.5;

        STATE.contra.bullets.forEach(b => {
          if (Math.hypot(b.x - cap.x, b.y - cap.y) < 18) {
            cap.alive = false;
            AUDIO.play('contra_explode');
            spawnExplosion(cap.x, cap.y);
            STATE.contra.pickups.push({
              x: cap.x, y: cap.y, vy: -3,
              type: cap.type, isArtifact: false,
              label: cap.type, color: '#ef4444'
            });
          }
        });
      });

      // 5. 装备战利品掉落物物理与拾取
      STATE.contra.pickups.forEach(pick => {
        pick.vy = (pick.vy || 0) + 0.22;
        pick.y += pick.vy;
        if (pick.vx) {
          pick.x += pick.vx;
          pick.vx *= 0.96;
        }

        // 地面吸附与弹性
        if (pick.y > cH - 50) {
          pick.y = cH - 50;
          if (Math.abs(pick.vy) > 1) pick.vy = -pick.vy * 0.4;
          else pick.vy = 0;
        }

        if (Math.hypot(pick.x - p.x, pick.y - p.y) < 24) {
          AUDIO.play('contra_30');
          handlePickupItem(pick);
          pick.y = 999; // 标记拾取销毁
        }
      });

      // 6. 多形态 BOSS 行为引擎
      if (STATE.contra.bossActive && STATE.contra.boss && !STATE.contra.boss.defeated) {
        const boss = STATE.contra.boss;
        boss.shootTimer++;

        if (boss.type === 'core') {
          // 要塞核心攻击
          if (boss.shootTimer % 80 === 0) {
            if (boss.leftTurretHp > 0) {
              STATE.contra.enemyBullets.push({ x: boss.x + 20, y: boss.y + 110, vx: -4.2, vy: 0 });
            }
            if (boss.rightTurretHp > 0) {
              STATE.contra.enemyBullets.push({ x: boss.x + 70, y: boss.y + 110, vx: -3.8, vy: 1.0 });
            }
          }
          if (boss.shootTimer % 130 === 0) {
            // 中央核心爆发 3 向火球
            for (let angleOff of [-0.25, 0, 0.25]) {
              STATE.contra.enemyBullets.push({
                x: boss.x + 45, y: boss.y + 60,
                vx: -4.0 * Math.cos(angleOff), vy: 4.0 * Math.sin(angleOff)
              });
            }
          }

          // 核心受击 (机体与能量核双层判定)
          STATE.contra.bullets.forEach(b => {
            if (b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
              const isCrit = Math.hypot(b.x - (boss.x + 45), b.y - (boss.y + 60)) < 28;
              boss.hp -= b.dmg * (isCrit ? 1.5 : 1.0);
              if (!b.piercing) b.y = -999;
              if (boss.hp <= 0 && !boss.defeated) triggerBossDefeat(boss);
            }
          });
        } else if (boss.type === 'mech') {
          // 步行机甲巡逻与震地攻击
          boss.x += boss.vx;
          boss.walkAnim += 0.12;
          if (boss.x < boss.minX || boss.x > boss.maxX) {
            boss.vx = -boss.vx;
            STATE.contra.screenShake = 12; // 转身震地
          }

          // 加特林机枪扫射
          if (boss.shootTimer % 75 < 20 && boss.shootTimer % 6 === 0) {
            STATE.contra.enemyBullets.push({
              x: boss.x - 10, y: boss.y + 70,
              vx: -5.2, vy: (Math.random() - 0.5) * 0.8
            });
          }
          // 高抛迫击炮弹
          if (boss.shootTimer % 150 === 0) {
            STATE.contra.enemyBullets.push({
              x: boss.x + 30, y: boss.y + 10,
              vx: -3.8, vy: -5.5, isMortar: true
            });
          }

          // 机甲全域受击判定
          STATE.contra.bullets.forEach(b => {
            if (b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
              boss.hp -= b.dmg;
              if (!b.piercing) b.y = -999;
              if (boss.hp <= 0 && !boss.defeated) triggerBossDefeat(boss);
            }
          });
        } else if (boss.type === 'alien') {
          // 浮空母舰正弦悬浮
          boss.floatT += 0.04;
          boss.y = boss.baseY + Math.sin(boss.floatT) * 32;

          // 定时下射扩散高能光束
          if (boss.shootTimer % 90 === 0) {
            for (let a of [-0.3, 0, 0.3]) {
              STATE.contra.enemyBullets.push({
                x: boss.x + 30, y: boss.y + 80,
                vx: -3.6 + Math.sin(a) * 2, vy: 3.2
              });
            }
          }
          // 360° 六向等离子光球
          if (boss.shootTimer % 180 === 0) {
            for (let k = 0; k < 6; k++) {
              const rad = (k * Math.PI) / 3;
              STATE.contra.enemyBullets.push({
                x: boss.x + boss.w / 2, y: boss.y + boss.h / 2,
                vx: Math.cos(rad) * 3.4, vy: Math.sin(rad) * 3.4
              });
            }
          }

          STATE.contra.bullets.forEach(b => {
            if (b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
              boss.hp -= b.dmg;
              if (!b.piercing) b.y = -999;
              if (boss.hp <= 0 && !boss.defeated) triggerBossDefeat(boss);
            }
          });
        }
      }

      // 7. 粒子衰减
      STATE.contra.particles.forEach(pt => {
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.03;
      });
      STATE.contra.particles = STATE.contra.particles.filter(pt => pt.life > 0);

      // 8. 内存回收垃圾清理 (GC) - 保持 60 FPS
      const minX = STATE.contra.cameraX - 350;
      STATE.contra.platforms = STATE.contra.platforms.filter(plat => plat.x + plat.w > minX);
      STATE.contra.enemies = STATE.contra.enemies.filter(en => en.hp > 0 && en.x > minX);
      STATE.contra.capsules = STATE.contra.capsules.filter(cap => cap.alive && cap.x > minX);
      STATE.contra.pickups = STATE.contra.pickups.filter(pick => pick.y < 500 && pick.x > minX);
      STATE.contra.bullets = STATE.contra.bullets.filter(b => b.x > minX && b.x < STATE.contra.cameraX + cW + 40 && b.y > -30 && b.y < cH + 30);
      STATE.contra.enemyBullets = STATE.contra.enemyBullets.filter(eb => eb.x > minX && eb.x < STATE.contra.cameraX + cW + 60 && eb.y < cH + 50);

      updateContraHUD();
    }

    // --- 5. BOSS 击溃大爆炸与神装爆破掉落 ---
    function triggerBossDefeat(boss) {
      if (!boss || boss.defeated) return;
      boss.defeated = true;

      try {
        if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('contra_explode');

        const bx = boss.x;
        const by = boss.y;
        const bw = boss.w || 100;
        const bh = boss.h || 100;
        const bName = boss.name || '巨兽 BOSS';

        // 震撼连续多级爆炸
        for (let k = 0; k < 30; k++) {
          setTimeout(() => {
            spawnExplosion(bx + Math.random() * bw, by + Math.random() * bh);
          }, k * 70);
        }

        const lvl = STATE.contra.bossCount + 1;
        STATE.contra.score += 3000 * lvl;
        STATE.contra.bossCount++;

        // 随机喷发 2~3 件装备与神兵！
        setTimeout(() => {
          try {
            spawnBossLootDrops(bx, by, bw, bh);
          } catch(e) {
            console.error('Loot drop error:', e);
          }
          // 解除摄像机锁定，重置 BOSS 战状态，让玩家拾取神装后继续向无限深处挺进！
          STATE.contra.bossActive = false;
          STATE.contra.bossLockX = null;
          STATE.contra.boss = null;
          STATE.contra.bossArenaX = null;
          STATE.contra.nextBossX = STATE.contra.player.x + 1400 + Math.random() * 400;
          if (typeof showToast === 'function') showToast(`🏆 强敌【${bName}】已被彻底歼灭！神装掉落！向前冲刺！`, 4000);
        }, 1800);
      } catch (err) {
        console.error('triggerBossDefeat error caught:', err);
        // 保底解除锁定，确保绝对不卡死
        STATE.contra.bossActive = false;
        STATE.contra.bossLockX = null;
        STATE.contra.boss = null;
        STATE.contra.bossArenaX = null;
      }
    }

    function spawnBossLootDrops(bx, by, bw, bh) {
      const dropCount = 2 + Math.floor(Math.random() * 2); // 2~3件
      const allDrops = [
        { type: 'S', isArtifact: false, label: 'S 散弹', color: '#ef4444' },
        { type: 'M', isArtifact: false, label: 'M 机枪', color: '#fbbf24' },
        { type: 'L', isArtifact: false, label: 'L 激光', color: '#38bdf8' },
        { type: 'F', isArtifact: false, label: 'F 烈焰', color: '#ec4899' },
        { type: 'C', isArtifact: false, label: 'C 追踪', color: '#10b981' },
        { type: 'SHIELD', isArtifact: true, label: '🛡️能量护盾', color: '#6366f1' },
        { type: 'DRONE', isArtifact: true, label: '🛸战术僚机', color: '#06b6d4' },
        { type: 'BOOTS', isArtifact: true, label: '⚡极速战靴', color: '#eab308' },
        { type: 'HEART', isArtifact: true, label: '💖强化血清', color: '#f43f5e' }
      ];

      // 洗牌抽取
      const shuffled = allDrops.sort(() => Math.random() - 0.5);
      const centerX = (bx !== undefined ? bx : STATE.contra.player.x + 100) + (bw || 80) / 2;
      const centerY = (by !== undefined ? by : STATE.contra.player.y - 40) + (bh || 80) / 2;
      for (let i = 0; i < dropCount; i++) {
        const item = shuffled[i];
        const angle = -Math.PI / 2 + (i - (dropCount - 1) / 2) * 0.5;
        const speed = 4.5 + Math.random() * 2.5;
        STATE.contra.pickups.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          type: item.type,
          isArtifact: item.isArtifact,
          label: item.label,
          color: item.color
        });
      }
    }

    // --- 6. 拾取物与神装赋予逻辑 ---
    function handlePickupItem(pick) {
      if (!pick.isArtifact) {
        // 主武器切换
        STATE.contra.weapon = pick.type;
        const names = { 'S': '🔴 S 散弹', 'M': '🟡 M 机枪', 'L': '🔵 L 激光', 'F': '🟣 F 烈焰螺旋弹', 'C': '🟢 C 智能追踪弹' };
        showToast(`🔫 装备主战神兵: ${names[pick.type] || pick.type}！`, 2500);
      } else {
        // 被动战术装备赋予
        if (pick.type === 'SHIELD') {
          STATE.contra.shield = Math.min(3, STATE.contra.shield + 2);
          showToast(`🛡️ 获得【能量力场护盾】！可吸收 2 次致命攻击！`, 3000);
        } else if (pick.type === 'DRONE') {
          STATE.contra.hasDrone = true;
          showToast(`🛸 启动【战术战斗僚机】！协同发射高能等离子光束！`, 3000);
        } else if (pick.type === 'BOOTS') {
          STATE.contra.hasBoots = true;
          showToast(`⚡ 装备【极速战靴】！移动速度 +35%，跳跃高度强化！`, 3000);
        } else if (pick.type === 'HEART') {
          STATE.contra.lives += 1;
          showToast(`💖 注射【强化血清】！生命值 +1！`, 2500);
        }
      }
      updateContraHUD();
    }

    // --- 7. 主角伤害与终局战报结算 ---
    function killContraPlayer() {
      // 能量护盾抵御检测
      if (STATE.contra.shield > 0) {
        STATE.contra.shield--;
        STATE.contra.player.invincibleTime = 100; // 1.6 秒绝对保护
        AUDIO.play('contra_30');

        // 护盾爆碎粒子
        for (let i = 0; i < 20; i++) {
          STATE.contra.particles.push({
            x: STATE.contra.player.x,
            y: STATE.contra.player.y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            life: 1.0,
            color: '#38bdf8'
          });
        }
        showToast(`🛡️ 能量力场抵挡了致命创伤！剩余护盾: ${STATE.contra.shield} 层！`, 2000);
        updateContraHUD();
        return;
      }

      AUDIO.play('contra_explode');
      spawnExplosion(STATE.contra.player.x, STATE.contra.player.y);
      STATE.contra.lives--;
      STATE.contra.weapon = 'NORMAL';
      updateContraHUD();

      if (STATE.contra.lives <= 0) {
        STATE.winner = 2;
        const dist = Math.floor(STATE.contra.player.x / 10);
        setTimeout(() => {
          showModal('💀 最终远征战报 (MISSION REPORT)', `
            <h3>🎖️ 魂斗罗·终极极限远征</h3><br>
            <p><strong>🏃 极限挺进距离：</strong><b style="color:#38bdf8; font-size:1.1rem;">${dist} 米</b></p><br>
            <p><strong>👑 斩杀 BOSS 总数：</strong><b style="color:#fbbf24; font-size:1.1rem;">${STATE.contra.bossCount} 尊</b></p><br>
            <p><strong>⭐ 最终战绩积分：</strong><b style="color:#ef4444; font-size:1.1rem;">${STATE.contra.score} 分</b></p><br>
            <p>点击下方按钮随时再次重开，向更远未知战场挺进！</p>
          `);
        }, 1000);
      } else {
        resetContraPlayer();
      }
    }

    function spawnExplosion(x, y) {
      for (let i = 0; i < 16; i++) {
        STATE.contra.particles.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 6.5,
          vy: (Math.random() - 0.5) * 6.5,
          life: 1.0,
          color: ['#ef4444', '#f59e0b', '#fbbf24', '#ffffff'][Math.floor(Math.random() * 4)]
        });
      }
    }

    // --- 8. Canvas 极致渲染引擎 ---
    function renderContra() {
      const c = document.getElementById('contra-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const camX = STATE.contra.cameraX;

      // 屏幕震动偏移
      let shakeOffsetX = 0, shakeOffsetY = 0;
      if (STATE.contra.screenShake > 0) {
        shakeOffsetX = (Math.random() - 0.5) * 6;
        shakeOffsetY = (Math.random() - 0.5) * 6;
      }

      ctx.save();
      ctx.translate(shakeOffsetX, shakeOffsetY);
      ctx.clearRect(0, 0, c.width, c.height);

      // 1. 无限视差夜空背景
      const skyGrad = ctx.createLinearGradient(0, 0, 0, c.height);
      skyGrad.addColorStop(0, '#030712');
      skyGrad.addColorStop(0.5, '#0b132b');
      skyGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, c.width, c.height);

      // 远景月亮 (视差微动)
      const moonX = ((c.width * 0.82 - camX * 0.05) % (c.width + 100) + c.width + 100) % (c.width + 100);
      ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(moonX, 55, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(moonX, 55, 26, 0, Math.PI * 2);
      ctx.fill();

      // 无限视差瀑布流
      const flowT = (Date.now() * 0.008) % 30;
      const waterX = ((200 - camX * 0.15) % 400 + 400) % 400;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(waterX, 60, 35, c.height - 100);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let fy = 60 + flowT; fy < c.height - 40; fy += 25) {
        ctx.fillRect(waterX + 2, fy, 31, 3);
      }

      // 无限循环丛林树影 (双层视差)
      ctx.fillStyle = '#062817';
      for (let i = -1; i < Math.ceil(c.width / 110) + 2; i++) {
        const treeX = ((i * 110 - camX * 0.2) % (c.width + 110) + c.width + 110) % (c.width + 110) - 50;
        ctx.beginPath();
        ctx.moveTo(treeX, c.height);
        ctx.lineTo(treeX + 55, c.height - 150);
        ctx.lineTo(treeX + 110, c.height);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-camX, 0);

      // 2. 绘制平台 (地面、高架钢梁与 BOSS 擂台)
      STATE.contra.platforms.forEach(plat => {
        if (plat.ground) {
          const groundGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
          if (plat.isArena) {
            // BOSS 竞技场醒目合金警戒网
            groundGrad.addColorStop(0, '#991b1b');
            groundGrad.addColorStop(0.3, '#334155');
            groundGrad.addColorStop(1, '#0f172a');
          } else {
            groundGrad.addColorStop(0, '#15803d');
            groundGrad.addColorStop(0.25, '#166534');
            groundGrad.addColorStop(1, '#0f172a');
          }
          ctx.fillStyle = groundGrad;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

          // 草尖或警示灯条
          ctx.fillStyle = plat.isArena ? '#ef4444' : '#4ade80';
          ctx.fillRect(plat.x, plat.y, plat.w, 4);

          ctx.fillStyle = plat.isArena ? '#fca5a5' : '#86efac';
          for (let gx = plat.x + 4; gx < plat.x + plat.w - 4; gx += 14) {
            ctx.fillRect(gx, plat.y - 2, 4, 3);
          }
        } else {
          // 悬空钢架横梁
          ctx.fillStyle = '#334155';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(plat.x, plat.y, plat.w, 3);
          ctx.fillStyle = '#cbd5e1';
          for (let rx = plat.x + 8; rx < plat.x + plat.w; rx += 20) {
            ctx.fillRect(rx, plat.y + 4, 3, 3);
          }
        }
      });

      // 3. 飞行胶囊
      STATE.contra.capsules.forEach(cap => {
        if (!cap.alive) return;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(cap.x, cap.y, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cap.x + 4, cap.y - 2, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. 绘制掉落装备与战利品光球 (带华丽呼吸光晕)
      STATE.contra.pickups.forEach(pick => {
        const glowPulse = 14 + Math.sin(Date.now() * 0.01) * 3;
        ctx.save();
        ctx.fillStyle = pick.color || '#fbbf24';
        ctx.beginPath();
        ctx.arc(pick.x, pick.y, glowPulse, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(pick.x, pick.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pick.type.length > 2 ? pick.type[0] : pick.type, pick.x, pick.y + 1);
        ctx.restore();
      });

      // 5. 绘制野怪敌人
      STATE.contra.enemies.forEach(en => {
        if (en.type === 'runner') {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(en.x - 8, en.y - 16, 16, 26);
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(en.x - 8, en.y - 20, 16, 6);
          ctx.fillStyle = '#000000';
          ctx.fillRect(en.x - 14, en.y - 4, 10, 4);
        } else if (en.type === 'sniper') {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(en.x - 10, en.y - 12, 20, 20);
          ctx.fillStyle = '#000000';
          ctx.fillRect(en.x - 18, en.y - 2, 14, 4);
        } else if (en.type === 'turret') {
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(en.x, en.y, 16, Math.PI, 0);
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(en.x, en.y);
          ctx.lineTo(en.x - 18, en.y - 8);
          ctx.stroke();
        }
      });

      // 6. 绘制多形态 BOSS
      if (STATE.contra.boss && !STATE.contra.boss.defeated) {
        const boss = STATE.contra.boss;

        if (boss.type === 'core') {
          // 要塞核心
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ef4444';
          ctx.strokeRect(boss.x, boss.y, boss.w, boss.h);

          // 左右双管火炮
          if (boss.leftTurretHp > 0) {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(boss.x + 10, boss.y + 100, 26, 20);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(boss.x - 12, boss.y + 106, 22, 8);
          }
          if (boss.rightTurretHp > 0) {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(boss.x + 60, boss.y + 100, 26, 20);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(boss.x + 42, boss.y + 106, 18, 8);
          }

          // 脉冲能量核心
          const pulse = 20 + Math.sin(Date.now() * 0.01) * 4;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(boss.x + 45, boss.y + 60, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else if (boss.type === 'mech') {
          // 巨型机甲
          const legSwing = Math.sin(boss.walkAnim) * 12;
          ctx.fillStyle = '#475569';
          // 左脚
          ctx.fillRect(boss.x + 15 + legSwing, boss.y + 85, 24, 50);
          // 右脚
          ctx.fillRect(boss.x + 75 - legSwing, boss.y + 85, 24, 50);

          // 机甲主胸甲
          ctx.fillStyle = '#334155';
          ctx.fillRect(boss.x, boss.y + 15, boss.w, 75);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#f59e0b';
          ctx.strokeRect(boss.x, boss.y + 15, boss.w, 75);

          // 加特林前置枪口
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(boss.x - 22, boss.y + 55, 26, 14);

          // 红色单目传感器
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(boss.x + 18, boss.y + 30, 36, 10);
        } else if (boss.type === 'alien') {
          // 异形浮空舰
          ctx.save();
          ctx.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.ellipse(0, 0, boss.w / 2, boss.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#818cf8';
          ctx.stroke();

          // 推进器荧光
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(boss.w / 2 - 10, 0, 10 + Math.sin(Date.now() * 0.02) * 3, 0, Math.PI * 2);
          ctx.fill();

          // 生物触须与能量舱
          ctx.fillStyle = '#ec4899';
          ctx.beginPath();
          ctx.arc(-20, 0, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 7. 绘制粒子
      STATE.contra.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 * pt.life, 0, Math.PI * 2);
        ctx.fill();
      });

      // 8. 绘制玩家子弹
      STATE.contra.bullets.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 9. 绘制敌方子弹
      STATE.contra.enemyBullets.forEach(eb => {
        ctx.fillStyle = eb.isMortar ? '#f97316' : '#ef4444';
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, eb.isMortar ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // 10. 绘制主角与装备视觉 (比尔)
      const p = STATE.contra.player;

      // 战术僚机 (在角色上方轨道飞行)
      if (STATE.contra.hasDrone) {
        const droneX = p.x + Math.cos(STATE.contra.droneAngle) * 22;
        const droneY = p.y - 26 + Math.sin(STATE.contra.droneAngle) * 8;
        ctx.save();
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(droneX, droneY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // 僚机机翼
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(droneX - 9, droneY - 2, 18, 3);
        ctx.restore();
      }

      // 能量力场护盾光罩
      if (STATE.contra.shield > 0) {
        ctx.save();
        const shieldGlow = 25 + Math.sin(Date.now() * 0.008) * 3;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, shieldGlow, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
        ctx.fill();
        ctx.restore();
      }

      // 金身无敌光环
      if (p.invincibleTime > 0) {
        ctx.save();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        if (ctx.setLineDash) ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.invincibleTime > 0 && p.invincibleTime % 6 < 2) {
        ctx.globalAlpha = 0.65;
      }

      if (!p.onGround) {
        // 空中翻滚火柴人/像素球体
        ctx.rotate(p.jumpAngle);
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#60a5fa';
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -4, 5, 5);
      } else if (p.crouch) {
        // 趴下姿势
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(p.facing === 1 ? -14 : -6, 4, 24, 12);
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(p.facing === 1 ? 4 : -12, 4, 8, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(p.facing === 1 ? 4 : -12, 3, 8, 3);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(p.facing === 1 ? 10 : -20, 8, 14, 4);
      } else {
        // 站立 / 奔跑
        ctx.fillStyle = '#fed7aa';
        ctx.fillRect(-6, -18, 12, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6, -20, 12, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-7, -15, 14, 3);
        if (p.facing === -1) ctx.fillRect(5, -15, 7, 3);
        else ctx.fillRect(-12, -15, 7, 3);

        ctx.fillStyle = '#2563eb';
        ctx.fillRect(-7, -6, 14, 14);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-6, 8, 5, 10);
        ctx.fillRect(1, 8, 5, 10);

        // 战靴颜色 (极速战靴为发光金/青色)
        ctx.fillStyle = STATE.contra.hasBoots ? '#06b6d4' : '#0f172a';
        ctx.fillRect(-7, 16, 6, 3);
        ctx.fillRect(1, 16, 6, 3);

        // 8 向步枪瞄准绘制
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -2);
        if (STATE.contra.keys.up && (STATE.contra.keys.left || STATE.contra.keys.right)) {
          ctx.lineTo(p.facing === 1 ? 16 : -16, -16);
        } else if (STATE.contra.keys.up) {
          ctx.lineTo(0, -20);
        } else {
          ctx.lineTo(p.facing === 1 ? 18 : -18, -2);
        }
        ctx.stroke();
      }

      ctx.restore();
      ctx.restore(); // 恢复镜头偏移

      // 11. 视口固定层：顶部专属 BOSS 宏伟血条与警报条
      if (STATE.contra.bossActive && STATE.contra.boss && !STATE.contra.boss.defeated) {
        const boss = STATE.contra.boss;
        const barW = Math.min(270, c.width - 50);
        const barX = (c.width - barW) / 2;
        const barY = 46; // 避开顶部 HTML HUD，整洁居中展示
        const pct = Math.max(0, boss.hp / boss.maxHp);

        // 边框底板
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(barX - 4, barY - 14, barW + 8, 30);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(barX - 4, barY - 14, barW + 8, 30);

        // 标签
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`👑 ${boss.name}`, barX, barY - 2);

        ctx.textAlign = 'right';
        ctx.fillText(`${Math.ceil(pct * 100)}%`, barX + barW, barY - 2);

        // 血条槽
        ctx.fillStyle = '#334155';
        ctx.fillRect(barX, barY + 2, barW, 8);

        const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        hpGrad.addColorStop(0, '#ef4444');
        hpGrad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = hpGrad;
        ctx.fillRect(barX, barY + 2, barW * pct, 8);
      }

      // BOSS 突袭警报横幅
      if (STATE.contra.bossAlertTimer > 0) {
        ctx.save();
        ctx.fillStyle = (STATE.contra.bossAlertTimer % 20 < 10) ? 'rgba(239, 68, 68, 0.75)' : 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(0, c.height / 2 - 24, c.width, 48);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ 🚨 WARNING! BOSS APPROACHING! 巨兽突袭！ 🚨 ⚠️', c.width / 2, c.height / 2);
        ctx.restore();
      }

      ctx.restore(); // 恢复震屏
    }

    function resetContraMatch() {
      initContraGame();
    }
