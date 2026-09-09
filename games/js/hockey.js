    // 6. 极光桌上冰球 (NEON AIR HOCKEY)
    // ==========================================================================
    let hockeyCanvas, hockeyCtx;

    function getHockeyCtx() {
      if (!hockeyCanvas) hockeyCanvas = document.getElementById('hockey-canvas');
      if (hockeyCanvas && !hockeyCtx) {
        hockeyCtx = hockeyCanvas.getContext('2d');
        hockeyCanvas.addEventListener('pointermove', onHockeyPointerMove);
        hockeyCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); onHockeyPointerMove(e); }, { passive: false });
      }
      return hockeyCanvas && hockeyCtx;
    }

    function initHockeyGame() {
      resetHockeyMatch();
      resizeHockeyCanvas();
      if (!STATE.hockey.animId) animateHockey();
    }

    function resetHockeyMatch() {
      STATE.hockey.p1Score = 0;
      STATE.hockey.p2Score = 0;
      STATE.winner = null;
      resetPuck(1);
    }

    function resetPuck(servingPlayer = 1) {
      const h = STATE.hockey;
      h.puck.x = 180;
      h.puck.y = servingPlayer === 1 ? 300 : 200;
      h.puck.vx = (Math.random() - 0.5) * 2;
      h.puck.vy = servingPlayer === 1 ? -3 : 3;
      h.paddle1.x = 180; h.paddle1.y = 440;
      h.paddle2.x = 180; h.paddle2.y = 60;
    }

    function resizeHockeyCanvas() {
      if (!getHockeyCtx()) return;
      const rect = hockeyCanvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      hockeyCanvas.width = rect.width * dpr;
      hockeyCanvas.height = rect.height * dpr;
      hockeyCtx.resetTransform();
      hockeyCtx.scale(dpr, dpr);
    }

    let hockeyLastTime = performance.now();
    let hockeyAccumulator = 0;
    const HOCKEY_FIXED_STEP = 1000 / 60;

    function animateHockey(now) {
      STATE.hockey.animId = requestAnimationFrame(animateHockey);
      if (STATE.currentGame !== 'HOCKEY' || STATE.currentView !== 'GAME') return;
      if (!getHockeyCtx()) return;

      const w = hockeyCanvas.getBoundingClientRect().width;
      const h = hockeyCanvas.getBoundingClientRect().height;
      if (w === 0 || h === 0) return;

      if (!now) now = performance.now();
      let elapsed = now - hockeyLastTime;
      hockeyLastTime = now;
      if (elapsed > 100) elapsed = 100;
      hockeyAccumulator += elapsed;

      while (hockeyAccumulator >= HOCKEY_FIXED_STEP) {
        updateHockeyPhysics(w, h);
        hockeyAccumulator -= HOCKEY_FIXED_STEP;
      }
      renderHockey(w, h);
    }

    function updateHockeyPhysics(w, h) {
      if (STATE.winner) return;
      const hk = STATE.hockey;
      const p = hk.puck;
      const pad1 = hk.paddle1;
      const pad2 = hk.paddle2;

      // 移动冰球
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.996; // 空气微弱阻力
      p.vy *= 0.996;

      // AI 追踪冰球 (Paddle 2)
      if (STATE.gameMode === 'AI') {
        const targetX = p.x;
        const targetY = p.y < h * 0.45 ? Math.max(50, p.y - 15) : 60;
        pad2.x += (targetX - pad2.x) * 0.12;
        pad2.y += (targetY - pad2.y) * 0.1;
      }

      // 左右侧边墙体碰撞
      if (p.x - p.radius < 0) { p.x = p.radius; p.vx = -p.vx * 0.95; AUDIO.play('hit'); spawnSparks(p.x, p.y, '#38bdf8'); }
      if (p.x + p.radius > w) { p.x = w - p.radius; p.vx = -p.vx * 0.95; AUDIO.play('hit'); spawnSparks(p.x, p.y, '#38bdf8'); }

      const goalLeft = w * 0.28, goalRight = w * 0.72;

      // 上方门线判定
      if (p.y - p.radius < 0) {
        if (p.x > goalLeft && p.x < goalRight) {
          // 进球！P1 得分！
          AUDIO.play('goal');
          hk.p1Score++;
          spawnSparks(p.x, p.y, '#ff4757', 35);
          showToast(`⚡ 绝杀破门！P1 得分！当前比分 ${hk.p1Score} : ${hk.p2Score}`);
          if (hk.p1Score >= hk.maxScore) {
            AUDIO.play('win');
            STATE.winner = 1;
            showModal('🎉 比赛获胜！', `P1 玩家率先攻入 ${hk.maxScore} 球，赢得极光冰球总冠军！`);
          } else {
            resetPuck(2);
          }
        } else {
          p.y = p.radius; p.vy = -p.vy * 0.95; AUDIO.play('hit'); spawnSparks(p.x, p.y, '#ff4757');
        }
      }

      // 下方门线判定
      if (p.y + p.radius > h) {
        if (p.x > goalLeft && p.x < goalRight) {
          // 进球！P2 得分！
          AUDIO.play('goal');
          hk.p2Score++;
          spawnSparks(p.x, p.y, '#2ed573', 35);
          showToast(`⚡ 破门得分！P2 得分！当前比分 ${hk.p1Score} : ${hk.p2Score}`);
          if (hk.p2Score >= hk.maxScore) {
            AUDIO.play('win');
            STATE.winner = 2;
            showModal('🎉 比赛结束', `P2 玩家/电脑率先攻入 ${hk.maxScore} 球，赢得极光冰球胜利！`);
          } else {
            resetPuck(1);
          }
        } else {
          p.y = h - p.radius; p.vy = -p.vy * 0.95; AUDIO.play('hit'); spawnSparks(p.x, p.y, '#2ed573');
        }
      }

      // 推盘与冰球圆周碰撞检测
      checkPaddleCollision(p, pad1);
      checkPaddleCollision(p, pad2);

      // 更新火花粒子
      for (let i = hk.particles.length - 1; i >= 0; i--) {
        const pt = hk.particles[i];
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.035;
        if (pt.life <= 0) hk.particles.splice(i, 1);
      }
    }

    function checkPaddleCollision(puck, pad) {
      const dx = puck.x - pad.x;
      const dy = puck.y - pad.y;
      const dist = Math.hypot(dx, dy);
      const minDist = puck.radius + pad.radius;

      if (dist < minDist) {
        AUDIO.play('hit');
        // 沿法线弹出
        const angle = Math.atan2(dy, dx);
        puck.x = pad.x + Math.cos(angle) * minDist;
        puck.y = pad.y + Math.sin(angle) * minDist;

        const speed = Math.hypot(puck.vx, puck.vy);
        const newSpeed = Math.min(18, Math.max(speed, 6) * 1.08);
        puck.vx = Math.cos(angle) * newSpeed;
        puck.vy = Math.sin(angle) * newSpeed;
        spawnSparks(puck.x, puck.y, '#f59e0b', 12);
      }
    }

    function spawnSparks(x, y, color, count = 10) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 5 + 1.5;
        STATE.hockey.particles.push({
          x, y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          color,
          life: 1.0
        });
      }
    }

    function renderHockey(w, h) {
      if (!getHockeyCtx()) return;
      hockeyCtx.clearRect(0, 0, w, h);
      const hk = STATE.hockey;

      // 冰球场背景
      hockeyCtx.fillStyle = '#080e1a';
      hockeyCtx.fillRect(0, 0, w, h);

      // 霓虹边线与中线
      hockeyCtx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      hockeyCtx.lineWidth = 2;
      hockeyCtx.beginPath();
      hockeyCtx.moveTo(0, h / 2); hockeyCtx.lineTo(w, h / 2);
      hockeyCtx.stroke();

      hockeyCtx.beginPath();
      hockeyCtx.arc(w / 2, h / 2, 45, 0, Math.PI * 2);
      hockeyCtx.stroke();

      // 球门
      const goalLeft = w * 0.28, goalRight = w * 0.72;
      hockeyCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      hockeyCtx.fillRect(goalLeft, 0, goalRight - goalLeft, 8);
      hockeyCtx.fillStyle = 'rgba(46, 213, 115, 0.3)';
      hockeyCtx.fillRect(goalLeft, h - 8, goalRight - goalLeft, 8);

      // 动态比分浮水印
      hockeyCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      hockeyCtx.font = 'bold 72px monospace';
      hockeyCtx.textAlign = 'center';
      hockeyCtx.fillText(`${hk.p2Score}`, w / 2, h / 2 - 30);
      hockeyCtx.fillText(`${hk.p1Score}`, w / 2, h / 2 + 80);

      // 绘制粒子
      for (const pt of hk.particles) {
        hockeyCtx.beginPath();
        hockeyCtx.arc(pt.x, pt.y, 2.5 * pt.life, 0, Math.PI * 2);
        hockeyCtx.fillStyle = pt.color;
        hockeyCtx.globalAlpha = pt.life;
        hockeyCtx.fill();
      }
      hockeyCtx.globalAlpha = 1.0;

      // 绘制球门推盘 2 (上方 P2/AI)
      hockeyCtx.beginPath();
      hockeyCtx.arc(hk.paddle2.x, hk.paddle2.y, hk.paddle2.radius, 0, Math.PI * 2);
      hockeyCtx.fillStyle = '#ef4444';
      hockeyCtx.shadowColor = '#ef4444'; hockeyCtx.shadowBlur = 12;
      hockeyCtx.fill();

      // 绘制球门推盘 1 (下方 P1)
      hockeyCtx.beginPath();
      hockeyCtx.arc(hk.paddle1.x, hk.paddle1.y, hk.paddle1.radius, 0, Math.PI * 2);
      hockeyCtx.fillStyle = '#22d3ee';
      hockeyCtx.shadowColor = '#22d3ee'; hockeyCtx.shadowBlur = 12;
      hockeyCtx.fill();

      // 绘制发光冰球
      hockeyCtx.beginPath();
      hockeyCtx.arc(hk.puck.x, hk.puck.y, hk.puck.radius, 0, Math.PI * 2);
      hockeyCtx.fillStyle = '#ffffff';
      hockeyCtx.shadowColor = '#38bdf8'; hockeyCtx.shadowBlur = 16;
      hockeyCtx.fill();
      hockeyCtx.shadowBlur = 0;
    }

    // 冰球触控/鼠标操作
    function onHockeyPointerMove(e) {
      if (STATE.currentGame !== 'HOCKEY' || !hockeyCanvas) return;
      const rect = hockeyCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      // P1 推盘严格限制在己方下半区
      STATE.hockey.paddle1.x = Math.max(STATE.hockey.paddle1.radius, Math.min(rect.width - STATE.hockey.paddle1.radius, px));
      STATE.hockey.paddle1.y = Math.max(rect.height * 0.52, Math.min(rect.height - STATE.hockey.paddle1.radius, py));
    }
