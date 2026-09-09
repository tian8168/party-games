// ==========================================================================
// 💥 魂斗罗 (Contra: 丛林突袭) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'CONTRA';
window.GAME_RULES = {
  'CONTRA': {"title":"💥 魂斗罗 规则与秘籍","body":"<p><strong>经典操作：</strong>WASD 移动瞄准，J/空格开火，K跳跃，S趴下。点击右上角【⚡ 30 条命】激活秘籍！</p>"}
};

const STATE = {
  currentView: 'GAME',

      currentGame: 'CONTRA',
      gameMode: 'LOCAL',
      contra: {
        lives: 3, weapon: 'NORMAL', score: 0, cameraX: 0, levelWidth: 2200,
        bossActive: false, bossDefeated: false,
        player: { x: 50, y: 220, vx: 0, vy: 0, w: 20, h: 36, onGround: false, facing: 1, crouch: false, aimUp: false, invincibleTime: 0, animFrame: 0, jumpAngle: 0 },
        bullets: [], enemyBullets: [], enemies: [], capsules: [], pickups: [], particles: [], platforms: [],
        boss: { x: 1950, y: 120, w: 160, h: 160, coreHp: 60, maxCoreHp: 60, turretLeftHp: 20, turretRightHp: 20, sniperHp: 15, active: false },
        keys: { left: false, right: false, up: false, down: false, fire: false, jump: false }, animId: null
      }
    
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
  
      if (typeof initContraGame === 'function') initContraGame();
      resetContraMatch();
      requestAnimationFrame(() => {
        resizeContraCanvas();
        renderContra();
      });
    
}

// --- 游戏专属引擎核心逻辑 ---
// 12. 魂斗罗 (CONTRA: 丛林突袭) 核心物理与关卡引擎
    // ==========================================================================
    function initContraGame() {
      STATE.contra.lives = 3;
      STATE.contra.weapon = 'NORMAL';
      STATE.contra.score = 0;
      STATE.contra.cameraX = 0;
      STATE.contra.bossActive = false;
      STATE.contra.bossDefeated = false;

      resizeContraCanvas();
      buildContraLevel();
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

    function buildContraLevel() {
      const H = window.innerWidth <= 480 ? 240 : 310;
      // 关卡平台定义 (x, y, w, h, isGround)
      STATE.contra.platforms = [
        // 初始草地地面 (宽幅出生平台，稳固防跌落)
        { x: -100, y: H - 40, w: 540, h: 40, ground: true },
        // 高架钢桥 1
        { x: 180, y: H - 110, w: 180, h: 14, ground: false },
        { x: 260, y: H - 175, w: 160, h: 14, ground: false },

        // 水洼河谷断桥
        { x: 490, y: H - 40, w: 320, h: 40, ground: true },
        { x: 450, y: H - 100, w: 140, h: 14, ground: false },
        { x: 610, y: H - 140, w: 160, h: 14, ground: false },
        { x: 530, y: H - 200, w: 180, h: 14, ground: false },

        // 中段钢架与巨岩
        { x: 860, y: H - 40, w: 460, h: 40, ground: true },
        { x: 920, y: H - 110, w: 180, h: 14, ground: false },
        { x: 1040, y: H - 170, w: 200, h: 14, ground: false },

        // 要塞门前高低坡
        { x: 1370, y: H - 40, w: 360, h: 40, ground: true },
        { x: 1420, y: H - 120, w: 160, h: 14, ground: false },
        { x: 1540, y: H - 190, w: 180, h: 14, ground: false },

        // Boss 要塞大厅平地
        { x: 1760, y: H - 40, w: 550, h: 40, ground: true },
        { x: 1780, y: H - 120, w: 120, h: 14, ground: false }
      ];

      // 重置敌兵与飞行胶囊
      STATE.contra.enemies = [
        { type: 'runner', x: 360, y: H - 75, vx: -1.2, hp: 1 },
        { type: 'runner', x: 550, y: H - 75, vx: -1.2, hp: 1 },
        { type: 'sniper', x: 680, y: H - 175, shootTimer: 60, hp: 2 },
        { type: 'turret', x: 980, y: H - 75, angle: Math.PI, shootTimer: 90, hp: 4 },
        { type: 'runner', x: 1100, y: H - 75, vx: -1.3, hp: 1 },
        { type: 'sniper', x: 1200, y: H - 205, shootTimer: 75, hp: 2 },
        { type: 'turret', x: 1480, y: H - 75, angle: Math.PI, shootTimer: 80, hp: 4 },
        { type: 'runner', x: 1620, y: H - 75, vx: -1.4, hp: 1 }
      ];

      STATE.contra.capsules = [
        { x: 220, y: 75, vx: 1.8, t: 0, type: 'S', alive: true },
        { x: 750, y: 65, vx: 1.8, t: 0, type: 'M', alive: true },
        { x: 1300, y: 70, vx: 1.8, t: 0, type: 'L', alive: true }
      ];

      STATE.contra.pickups = [];
      STATE.contra.bullets = [];
      STATE.contra.enemyBullets = [];
      STATE.contra.particles = [];

      // 初始化 Boss
      STATE.contra.boss = {
        x: 1980, y: H - 200, w: 120, h: 160,
        coreHp: 65, maxCoreHp: 65,
        leftTurretHp: 20, rightTurretHp: 20,
        sniperHp: 15,
        shootTimer: 0,
        defeated: false
      };
    }

    function resetContraPlayer() {
      const H = window.innerWidth <= 480 ? 240 : 310;
      const p = STATE.contra.player;
      p.x = Math.max(50, STATE.contra.cameraX + 40);
      p.y = H - 40 - 18; // 出生稳立于地表，绝不产生穿透摔死
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.facing = 1;
      p.crouch = false;
      p.aimUp = false;
      p.jumpAngle = 0;
      p.invincibleTime = 120; // 2秒无敌金身
    }

    function updateContraHUD() {
      const lifeDisplay = document.getElementById('contra-life-display');
      if (lifeDisplay) lifeDisplay.textContent = `🔴 P1: ${STATE.contra.lives}命`;

      const weaponMap = {
        'NORMAL': 'GUN: [ 普通单发 ]',
        'S': 'GUN: [ 🔴 S 弹·五向散射 ]',
        'M': 'GUN: [ 🟡 M 机枪·极速突突 ]',
        'L': 'GUN: [ 🔵 L 激光·高能穿透 ]'
      };
      const weaponDisplay = document.getElementById('contra-weapon-display');
      if (weaponDisplay) weaponDisplay.textContent = weaponMap[STATE.contra.weapon] || 'GUN: [ 普通 ]';
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

      // 键盘监听
      window.onkeydown = (e) => {
        if (STATE.currentGame !== 'CONTRA') return;

        // 屏蔽浏览器方向键和空格键默认页面滚动
        if (['KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        // 键盘 Konami 秘籍检测
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

      // 移动端虚拟按键事件
      const bindTouch = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;
        const down = (e) => { e.preventDefault(); el.classList.add('active'); onDown(); };
        const up = (e) => { e.preventDefault(); el.classList.remove('active'); onUp(); };
        el.onmousedown = down; el.onmouseup = up;
        el.ontouchstart = down; el.ontouchend = up;
        el.ontouchcancel = up;
      };

      bindTouch('btn-dpad-left',  () => { keys.left = true; }, () => { keys.left = false; });
      bindTouch('btn-dpad-right', () => { keys.right = true; }, () => { keys.right = false; });
      bindTouch('btn-dpad-up',    () => { keys.up = true; }, () => { keys.up = false; });
      bindTouch('btn-dpad-down',  () => { keys.down = true; }, () => { keys.down = false; });

      bindTouch('btn-contra-fire', () => { fireContraPlayer(); keys.fire = true; }, () => { keys.fire = false; });
      bindTouch('btn-contra-jump', () => { jumpContraPlayer(); keys.jump = true; }, () => { keys.jump = false; });

      // 鼠标/触屏点击画面直接开火
      const c = document.getElementById('contra-canvas');
      if (c && !c._pointerBound) {
        c._pointerBound = true;
        c.addEventListener('pointerdown', (e) => {
          if (STATE.currentGame !== 'CONTRA') return;
          const rect = c.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const p = STATE.contra.player;
          p.facing = (clickX + STATE.contra.cameraX >= p.x) ? 1 : -1;
          fireContraPlayer();
        });
      }
    }

    function jumpContraPlayer() {
      const p = STATE.contra.player;
      if (p.onGround) {
        // 如果按住下键+跳跃，执行穿透跳板下落
        if (STATE.contra.keys.down) {
          p.y += 8;
          p.onGround = false;
        } else {
          p.vy = -9.2;
          p.onGround = false;
          AUDIO.play('contra_jump');
        }
      }
    }

    function fireContraPlayer() {
      AUDIO.init();
      const p = STATE.contra.player;
      const keys = STATE.contra.keys;

      // 判定 8 向射击角度
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
          vx: Math.cos(angle) * 8.5, vy: Math.sin(angle) * 8.5,
          color: '#f8fafc', r: 3, dmg: 1
        });
      } else if (weapon === 'S') {
        // 5 向扇形散弹！
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
          vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10,
          color: '#fbbf24', r: 3.5, dmg: 1
        });
      } else if (weapon === 'L') {
        // 高能贯穿激光
        AUDIO.play('contra_shoot');
        STATE.contra.bullets.push({
          x: spawnX, y: spawnY,
          vx: Math.cos(angle) * 13, vy: Math.sin(angle) * 13,
          color: '#38bdf8', r: 5, dmg: 3, piercing: true
        });
      }
    }

    // --- 主循环与物理更新 ---
    function startContraLoop() {
      if (STATE.contra.animId) cancelAnimationFrame(STATE.contra.animId);

      let lastTime = performance.now();
      let accumulator = 0;
      const FIXED_STEP = 1000 / 60;

      function loop(now) {
        if (STATE.currentGame === 'CONTRA') {
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
          STATE.contra.animId = requestAnimationFrame(loop);
        }
      }
      loop(performance.now());
    }

    function updateContraPhysics() {
      const p = STATE.contra.player;
      const keys = STATE.contra.keys;

      // 连续开火支持 (按住开火键且武器为 M 连发)
      if (keys.fire && (STATE.contra.weapon === 'M' || Math.random() < 0.15)) {
        fireContraPlayer();
      }

      // 移动与朝向
      p.crouch = keys.down && p.onGround;
      if (!p.crouch) {
        if (keys.left) { p.vx = -2.6; p.facing = -1; }
        else if (keys.right) { p.vx = 2.6; p.facing = 1; }
        else { p.vx = 0; }
      } else {
        p.vx = 0;
      }

      // 重力加速度与终端速度保护
      p.vy = Math.min(p.vy + 0.44, 11);
      p.x += p.vx;
      p.y += p.vy;

      // 跳跃空中翻滚动画
      if (!p.onGround) {
        p.jumpAngle += 0.35 * p.facing;
      } else {
        p.jumpAngle = 0;
      }

      // 无敌时间衰减
      if (p.invincibleTime > 0) p.invincibleTime--;

      // 平台碰撞判定 (从上方落下吸附)
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

      // 坠坑死亡检测
      const c = document.getElementById('contra-canvas');
      const limitY = (c && c.height) ? c.height + 40 : 350;
      if (p.y > limitY) {
        killContraPlayer();
      }

      // 摄像机横向推进行走（经典不能后退）
      if (p.x - STATE.contra.cameraX > (c ? c.width * 0.45 : 200) && STATE.contra.cameraX < 1720) {
        STATE.contra.cameraX = p.x - (c ? c.width * 0.45 : 200);
      }
      if (p.x < STATE.contra.cameraX + 12) p.x = STATE.contra.cameraX + 12;

      // 进入 Boss 战检测
      if (STATE.contra.cameraX >= 1700 && !STATE.contra.bossActive) {
        STATE.contra.bossActive = true;
        showToast('🚨 警报！已抵达第一关基地防线要塞！集火轰爆中央感应核心！', 4000);
      }

      // 1. 子弹更新与碰撞
      STATE.contra.bullets.forEach(b => {
        b.x += b.vx; b.y += b.vy;
      });
      // 出屏幕销毁
      const cW = c ? c.width : 480;
      const cH = c ? c.height : 310;
      STATE.contra.bullets = STATE.contra.bullets.filter(b => b.x > STATE.contra.cameraX - 20 && b.x < STATE.contra.cameraX + cW + 20 && b.y > -20 && b.y < cH + 20);

      // 敌方子弹更新
      STATE.contra.enemyBullets.forEach(eb => {
        eb.x += eb.vx; eb.y += eb.vy;
        // 击中主角
        if (p.invincibleTime <= 0 && Math.hypot(eb.x - p.x, eb.y - (p.crouch ? p.y + 10 : p.y)) < 16) {
          killContraPlayer();
        }
      });
      STATE.contra.enemyBullets = STATE.contra.enemyBullets.filter(eb => eb.x > STATE.contra.cameraX - 50 && eb.x < STATE.contra.cameraX + cW + 50);

      // 2. 敌兵更新与受击
      STATE.contra.enemies.forEach(en => {
        if (en.type === 'runner') {
          en.x += en.vx;
          // 触碰主角
          if (p.invincibleTime <= 0 && Math.hypot(en.x - p.x, en.y - p.y) < 20) {
            killContraPlayer();
          }
        } else if (en.type === 'sniper') {
          en.shootTimer--;
          if (en.shootTimer <= 0 && Math.abs(en.x - p.x) < 320) {
            en.shootTimer = 110;
            const a = Math.atan2(p.y - en.y, p.x - en.x);
            STATE.contra.enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5 });
          }
        } else if (en.type === 'turret') {
          en.shootTimer--;
          if (en.shootTimer <= 0 && Math.abs(en.x - p.x) < 280) {
            en.shootTimer = 130;
            const a = Math.atan2(p.y - en.y, p.x - en.x);
            STATE.contra.enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2 });
          }
        }

        // 子弹打击敌人
        STATE.contra.bullets.forEach(b => {
          if (Math.hypot(b.x - en.x, b.y - en.y) < 18) {
            en.hp -= b.dmg;
            if (!b.piercing) b.y = -999; // 销毁子弹
            if (en.hp <= 0) {
              AUDIO.play('contra_explode');
              STATE.contra.score += 100;
              spawnExplosion(en.x, en.y);
            }
          }
        });
      });
      STATE.contra.enemies = STATE.contra.enemies.filter(en => en.hp > 0 && en.x > STATE.contra.cameraX - 80);

      // 3. 飞行胶囊
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
            // 掉落武器徽章
            STATE.contra.pickups.push({ x: cap.x, y: cap.y, vy: -3, type: cap.type });
          }
        });
      });

      // 4. 拾取物掉落
      STATE.contra.pickups.forEach(pick => {
        pick.vy += 0.2;
        pick.y += pick.vy;
        if (pick.y > cH - 50) { pick.y = cH - 50; pick.vy = 0; }

        if (Math.hypot(pick.x - p.x, pick.y - p.y) < 24) {
          AUDIO.play('contra_30');
          STATE.contra.weapon = pick.type;
          showToast(`🔫 拾取强力神兵: ${pick.type} 弹！`, 2000);
          updateContraHUD();
          pick.y = 999;
        }
      });
      STATE.contra.pickups = STATE.contra.pickups.filter(pick => pick.y < 500);

      // 5. Boss 战逻辑
      if (STATE.contra.bossActive && !STATE.contra.boss.defeated) {
        const boss = STATE.contra.boss;
        boss.shootTimer++;

        // 定时双管激光发射
        if (boss.shootTimer % 90 === 0) {
          if (boss.leftTurretHp > 0) {
            STATE.contra.enemyBullets.push({ x: boss.x + 20, y: boss.y + 110, vx: -4.2, vy: 0 });
          }
          if (boss.rightTurretHp > 0) {
            STATE.contra.enemyBullets.push({ x: boss.x + 70, y: boss.y + 110, vx: -3.8, vy: 1.2 });
          }
        }

        // 子弹打击 Boss 部位
        STATE.contra.bullets.forEach(b => {
          // 左炮台
          if (boss.leftTurretHp > 0 && Math.hypot(b.x - (boss.x + 20), b.y - (boss.y + 110)) < 22) {
            boss.leftTurretHp -= b.dmg;
            if (!b.piercing) b.y = -999;
            if (boss.leftTurretHp <= 0) spawnExplosion(boss.x + 20, boss.y + 110);
          }
          // 右炮台
          if (boss.rightTurretHp > 0 && Math.hypot(b.x - (boss.x + 70), b.y - (boss.y + 110)) < 22) {
            boss.rightTurretHp -= b.dmg;
            if (!b.piercing) b.y = -999;
            if (boss.rightTurretHp <= 0) spawnExplosion(boss.x + 70, boss.y + 110);
          }
          // 中央核心
          if (Math.hypot(b.x - (boss.x + 45), b.y - (boss.y + 60)) < 25) {
            boss.coreHp -= b.dmg;
            if (!b.piercing) b.y = -999;
            if (boss.coreHp <= 0 && !boss.defeated) {
              boss.defeated = true;
              AUDIO.play('contra_explode');
              for (let k = 0; k < 25; k++) {
                setTimeout(() => {
                  spawnExplosion(boss.x + Math.random() * 100, boss.y + Math.random() * 120);
                }, k * 90);
              }
              setTimeout(() => {
                showModal('通关大捷！', '<h3>🏆 MISSION ACCOMPLISHED!</h3><br><p>恭喜通关第一关【丛林突袭】！要塞核心已被彻底摧毁！</p>');
              }, 2600);
            }
          }
        });
      }

      // 粒子更新
      STATE.contra.particles.forEach(pt => {
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.03;
      });
      STATE.contra.particles = STATE.contra.particles.filter(pt => pt.life > 0);
    }

    function killContraPlayer() {
      AUDIO.play('contra_explode');
      spawnExplosion(STATE.contra.player.x, STATE.contra.player.y);
      STATE.contra.lives--;
      STATE.contra.weapon = 'NORMAL';
      updateContraHUD();

      if (STATE.contra.lives <= 0) {
        setTimeout(() => {
          showModal('GAME OVER', '<h3>💀 阵亡！生命值耗尽！</h3><br><p>别灰心！点击右上角【⚡ 30条命秘籍】直接重出江湖！</p>');
        }, 1000);
      } else {
        resetContraPlayer();
      }
    }

    function spawnExplosion(x, y) {
      for (let i = 0; i < 14; i++) {
        STATE.contra.particles.push({
          x: x, y: y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 1.0,
          color: ['#ef4444', '#f59e0b', '#fbbf24', '#ffffff'][Math.floor(Math.random() * 4)]
        });
      }
    }

    // --- Canvas 绘制 ---
    function renderContra() {
      const c = document.getElementById('contra-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const camX = STATE.contra.cameraX;

      ctx.clearRect(0, 0, c.width, c.height);

      // 远景夜空渐变 (深邃丛林夜幕)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, c.height);
      skyGrad.addColorStop(0, '#030712');
      skyGrad.addColorStop(0.5, '#0b132b');
      skyGrad.addColorStop(1, '#064e3b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, c.width, c.height);

      // 远景月亮与夜云光晕
      ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(c.width * 0.82, 55, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(c.width * 0.82, 55, 26, 0, Math.PI * 2);
      ctx.fill();

      // 视差背景瀑布流水 (动态流动白浪)
      const flowT = (Date.now() * 0.008) % 30;
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(140 - (camX * 0.15) % 300, 60, 35, c.height - 100);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let fy = 60 + flowT; fy < c.height - 40; fy += 25) {
        ctx.fillRect(142 - (camX * 0.15) % 300, fy, 31, 3);
      }

      // 视差背景丛林树影 (双层视差)
      ctx.fillStyle = '#062817';
      for (let i = -1; i < 10; i++) {
        const treeX = i * 120 - (camX * 0.2) % 120;
        ctx.beginPath();
        ctx.moveTo(treeX, c.height);
        ctx.lineTo(treeX + 60, c.height - 150);
        ctx.lineTo(treeX + 120, c.height);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(-camX, 0);

      // 绘制平台 (地面与钢架横梁)
      STATE.contra.platforms.forEach(plat => {
        if (plat.ground) {
          // 地表生机盎然的青苔与厚土
          const groundGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
          groundGrad.addColorStop(0, '#15803d');
          groundGrad.addColorStop(0.25, '#166534');
          groundGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = groundGrad;
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

          // 草地顶层亮绿荧光条
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(plat.x, plat.y, plat.w, 4);

          // 草尖装饰
          ctx.fillStyle = '#86efac';
          for (let gx = plat.x + 4; gx < plat.x + plat.w - 4; gx += 14) {
            ctx.fillRect(gx, plat.y - 2, 4, 3);
          }
        } else {
          // 红色警示与合金桁架钢梁
          ctx.fillStyle = '#334155';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

          // 警示顶边缘
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(plat.x, plat.y, plat.w, 3);

          // 铆钉与钢架交叉线
          ctx.fillStyle = '#cbd5e1';
          for (let rx = plat.x + 8; rx < plat.x + plat.w; rx += 20) {
            ctx.fillRect(rx, plat.y + 4, 3, 3);
          }
        }
      });

      // 绘制飞行胶囊
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

      // 绘制掉落徽章
      STATE.contra.pickups.forEach(pick => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pick.x, pick.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pick.type, pick.x, pick.y + 1);
      });

      // 绘制敌人
      STATE.contra.enemies.forEach(en => {
        if (en.type === 'runner') {
          // 红衣奔跑兵
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(en.x - 8, en.y - 16, 16, 26);
          // 头盔
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(en.x - 8, en.y - 20, 16, 6);
          // 步枪
          ctx.fillStyle = '#000000';
          ctx.fillRect(en.x - 14, en.y - 4, 10, 4);
        } else if (en.type === 'sniper') {
          // 狙击手
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(en.x - 10, en.y - 12, 20, 20);
          ctx.fillStyle = '#000000';
          ctx.fillRect(en.x - 18, en.y - 2, 14, 4);
        } else if (en.type === 'turret') {
          // 半圆旋转地堡炮台
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

      // 绘制要塞 Boss
      if (STATE.contra.boss) {
        const boss = STATE.contra.boss;
        // 要塞钢铁基座外壳
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(boss.x, boss.y, boss.w, boss.h);

        // 左双管炮
        if (boss.leftTurretHp > 0) {
          ctx.fillStyle = '#64748b';
          ctx.fillRect(boss.x + 10, boss.y + 100, 26, 20);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(boss.x - 12, boss.y + 106, 22, 8);
        }

        // 右双管炮
        if (boss.rightTurretHp > 0) {
          ctx.fillStyle = '#64748b';
          ctx.fillRect(boss.x + 60, boss.y + 100, 26, 20);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(boss.x + 42, boss.y + 106, 18, 8);
        }

        // 中央红色感应核心 (不断脉冲跳动)
        if (!boss.defeated) {
          const pulse = 18 + Math.sin(Date.now() * 0.008) * 4;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(boss.x + 45, boss.y + 60, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          // 核心血量槽
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(boss.x + 10, boss.y + 10, 80, 8);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(boss.x + 10, boss.y + 10, 80 * (boss.coreHp / boss.maxCoreHp), 8);
        }
      }

      // 绘制粒子
      STATE.contra.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 * pt.life, 0, Math.PI * 2);
        ctx.fill();
      });

      // 绘制玩家子弹
      STATE.contra.bullets.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 绘制敌方子弹 (经典红火球)
      STATE.contra.enemyBullets.forEach(eb => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // 绘制主角比尔 (Bill) - 永不完全隐形
      const p = STATE.contra.player;

      // 无敌金身光环
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
        ctx.globalAlpha = 0.65; // 半透明闪烁，但永远清晰可见！
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
        // 翻滚红色头带残影
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2, -4, 5, 5);
      } else if (p.crouch) {
        // 趴下姿势
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(p.facing === 1 ? -14 : -6, 4, 24, 12);
        ctx.fillStyle = '#fecaca'; // 脸部
        ctx.fillRect(p.facing === 1 ? 4 : -12, 4, 8, 8);
        ctx.fillStyle = '#ef4444'; // 红色头带
        ctx.fillRect(p.facing === 1 ? 4 : -12, 3, 8, 3);
        ctx.fillStyle = '#0f172a'; // 步枪
        ctx.fillRect(p.facing === 1 ? 10 : -20, 8, 14, 4);
      } else {
        // 站立 / 奔跑
        // 头部与经典红头带
        ctx.fillStyle = '#fed7aa'; // 肤色
        ctx.fillRect(-6, -18, 12, 12);
        // 金色短发
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6, -20, 12, 4);
        // 红色头带
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-7, -15, 14, 3);
        if (p.facing === -1) {
          ctx.fillRect(5, -15, 7, 3); // 飘扬飘带
        } else {
          ctx.fillRect(-12, -15, 7, 3);
        }

        // 蓝色战术背心身躯
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(-7, -6, 14, 14);

        // 迷彩战术长裤
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-6, 8, 5, 10);
        ctx.fillRect(1, 8, 5, 10);
        // 军靴
        ctx.fillStyle = '#0f172a';
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
      ctx.restore();
    }

    function resetContraMatch() {
      initContraGame();
    }

    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('CONTRA');
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
