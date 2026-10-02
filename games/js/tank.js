    // 10. 极限抛物线弹道核心逻辑 (TANK)
    // ==========================================================================
    function initTankGame() {
      if (STATE.tank.modalTimer) { clearTimeout(STATE.tank.modalTimer); STATE.tank.modalTimer = null; }
      if (STATE.tank.aiTimer) { clearTimeout(STATE.tank.aiTimer); STATE.tank.aiTimer = null; }
      if (STATE.tank.animId) { cancelAnimationFrame(STATE.tank.animId); STATE.tank.animId = null; }
      STATE.tank.p1Hp = 100;
      STATE.tank.p2Hp = 100;
      STATE.tank.bullet = null;
      STATE.turn = 1;
      const hp1 = document.getElementById('tank-hp-p1');
      const hp2 = document.getElementById('tank-hp-p2');
      if (hp1) hp1.style.width = '100%';
      if (hp2) hp2.style.width = '100%';
      resizeTankCanvas();
      generateTankTerrain();
      updateTankWind();
      syncTankControlsUI();
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

    function syncTankControlsUI() {
      const curTank = STATE.turn === 1 ? STATE.tank.tank1 : STATE.tank.tank2;
      const angleSlider = document.getElementById('tank-angle-slider');
      const powerSlider = document.getElementById('tank-power-slider');
      const angleVal = document.getElementById('tank-angle-val');
      const powerVal = document.getElementById('tank-power-val');
      const fireBtn = document.getElementById('btn-tank-fire');
      const p2Label = document.getElementById('tank-p2-label');

      if (p2Label) {
        p2Label.textContent = STATE.gameMode === 'LOCAL' ? '🟢 玩家 2' : '🟢 电脑坦克';
      }
      if (angleSlider && curTank) angleSlider.value = curTank.angle;
      if (powerSlider && curTank) powerSlider.value = curTank.power;
      if (angleVal && curTank) angleVal.textContent = `${curTank.angle}°`;
      if (powerVal && curTank) powerVal.textContent = `${curTank.power}%`;

      if (fireBtn) {
        if (STATE.turn === 1) {
          fireBtn.disabled = false;
          fireBtn.textContent = '🔥 🔴 P1 发射炮弹！';
        } else if (STATE.turn === 2 && STATE.gameMode === 'LOCAL') {
          fireBtn.disabled = false;
          fireBtn.textContent = '🔥 🟢 P2 发射炮弹！';
        } else if (STATE.turn === 2 && STATE.gameMode === 'AI') {
          fireBtn.disabled = true;
          fireBtn.textContent = '🤖 电脑锁定瞄准中...';
        }
      }
    }

    function updateTankAimHUD() {
      const angle = document.getElementById('tank-angle-slider').value;
      const power = document.getElementById('tank-power-slider').value;
      document.getElementById('tank-angle-val').textContent = `${angle}°`;
      document.getElementById('tank-power-val').textContent = `${power}%`;

      const curTank = STATE.turn === 1 ? STATE.tank.tank1 : STATE.tank.tank2;
      curTank.angle = parseInt(angle);
      curTank.power = parseInt(power);
      renderTank();
    }

    function fireTankPlayer() {
      if (STATE.tank.bullet) return;
      if (STATE.turn === 1) {
        const t1 = STATE.tank.tank1;
        fireTankBullet(t1.x, t1.y - 6, t1.angle, t1.power, 1);
      } else if (STATE.turn === 2 && STATE.gameMode === 'LOCAL') {
        const t2 = STATE.tank.tank2;
        fireTankBullet(t2.x, t2.y - 6, t2.angle, t2.power, 2);
      }
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
        if (STATE.tank.modalTimer) clearTimeout(STATE.tank.modalTimer);
        STATE.tank.modalTimer = setTimeout(() => {
          const winMsg = STATE.tank.p1Hp > 0
            ? '🏆 🔴 玩家 1 获胜！神级高抛轰平了对方的防御！'
            : (STATE.gameMode === 'LOCAL' ? '🏆 🟢 玩家 2 获胜！精准弹道彻底摧毁红方战车！' : '💀 战车装甲破损，敌方炮火更胜一筹！');
          showModal('坦克大战 战报', winMsg);
        }, 1000);
      } else {
        STATE.turn = STATE.turn === 1 ? 2 : 1;
        updateTankWind();
        if (typeof updateScoreboard === 'function') updateScoreboard();
        syncTankControlsUI();
        if (STATE.turn === 2 && STATE.gameMode === 'AI') {
          if (STATE.tank.aiTimer) clearTimeout(STATE.tank.aiTimer);
          STATE.tank.aiTimer = setTimeout(runTankAI, 1400);
        }
      }
    }

    function runTankAI() {
      if (STATE.turn !== 2 || STATE.tank.bullet || STATE.tank.p1Hp <= 0 || STATE.tank.p2Hp <= 0) return;
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
