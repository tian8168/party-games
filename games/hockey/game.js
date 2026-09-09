// ==========================================================================
// 🏒 极光空气桌上冰球 · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'HOCKEY';
window.GAME_RULES = {
  'HOCKEY': {"title":"极光空气冰球 规则","body":"<p><strong>碰撞竞技：</strong>滑动己方推盘，利用刚体弹力高速撞击发光的冰球！率先达到 <b>5 分</b> 者获胜！</p>"}
};

const STATE = {
  currentView: 'GAME',

      currentGame: 'HOCKEY',
      gameMode: 'AI',
      winner: null,
      hockey: { p1Score: 0, p2Score: 0, maxScore: 5, puck: { x: 180, y: 250, vx: 0, vy: 0, radius: 14 }, paddle1: { x: 180, y: 440, radius: 22 }, paddle2: { x: 180, y: 60, radius: 22 }, particles: [], animId: null }
    
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
  
      if (typeof initHockeyGame === 'function') initHockeyGame();
      resetHockeyMatch();
      requestAnimationFrame(() => {
        resizeHockeyCanvas();
      });
    
}

// --- 游戏专属引擎核心逻辑 ---
// 6. 极光桌上冰球 (NEON AIR HOCKEY)
    // ==========================================================================
    const hockeyCanvas = document.getElementById('hockey-canvas');
    const hockeyCtx = hockeyCanvas.getContext('2d');

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
      if (STATE.currentGame !== 'HOCKEY') return;
      const rect = hockeyCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const px = clientX - rect.left;
      const py = clientY - rect.top;

      // P1 推盘严格限制在己方下半区
      STATE.hockey.paddle1.x = Math.max(STATE.hockey.paddle1.radius, Math.min(rect.width - STATE.hockey.paddle1.radius, px));
      STATE.hockey.paddle1.y = Math.max(rect.height * 0.52, Math.min(rect.height - STATE.hockey.paddle1.radius, py));
    }

    hockeyCanvas.addEventListener('pointermove', onHockeyPointerMove);
    hockeyCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); onHockeyPointerMove(e); }, { passive: false });

    // ==========================================================================
    // 7. MQTT 在线联机通信中枢
    // ==========================================================================
    const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
    let myClientId = 'client_' + Math.random().toString(36).substring(2, 9);

    function initMqtt(roomId, role) {
      if (STATE.online.mqttClient) {
        try { STATE.online.mqttClient.end(); } catch (e) {}
      }

      STATE.online.roomId = roomId;
      STATE.online.myRole = role;
      document.getElementById('display-room-id').textContent = roomId;
      document.getElementById('display-role-info').innerHTML = role === 'host' ? 
        '你是 <b style="color:var(--p1-color)">🔴 房主 (红方)</b>' : 
        '你是 <b style="color:var(--p2-color)">🟢 好友 (客方)</b>';

      showToast(`正在连接房间 ${roomId}...`);
      const client = mqtt.connect(MQTT_BROKER, { clientId: myClientId, keepalive: 30, clean: true });
      STATE.online.mqttClient = client;

      client.on('connect', () => {
        STATE.online.connected = true;
        const topic = `game_hall_v2/room/${roomId}`;
        client.subscribe(topic, () => {
          if (role === 'guest') {
            client.publish(topic, JSON.stringify({ type: 'JOIN', sender: myClientId, game: STATE.currentGame }));
            showToast('已进入房间，正在等待同步...');
          } else {
            showToast('房间已就绪！点击复制链接发给好友');
          }
        });
      });

      client.on('message', (topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (msg.sender === myClientId) return;

          if (msg.type === 'JOIN') {
            if (STATE.online.myRole === 'host') {
              STATE.online.opponentJoined = true;
              showToast('🎉 好友已进入房间！对战正式开始！');
              sendOnlineAction({ type: 'SYNC', game: STATE.currentGame, turn: STATE.turn });
              updateScoreboard();
            }
          } else if (msg.type === 'SYNC') {
            if (STATE.online.myRole === 'guest') {
              STATE.online.opponentJoined = true;
              if (msg.game && msg.game !== STATE.currentGame) {
                enterGame(msg.game, 'ONLINE');
              }
              showToast('🎮 同步成功，对战开始！');
              updateScoreboard();
            }
          } else if (msg.type === 'QUORIDOR_MOVE') {
            executeQuoridorMove(msg.r, msg.c);
          } else if (msg.type === 'QUORIDOR_WALL') {
            executeQuoridorWall(msg.wallType, msg.r, msg.c);
          } else if (msg.type === 'GRAVITY_DROP') {
            const tr = getGravityLandingRow(msg.col);
            if (tr !== -1) executeGravityDrop(msg.col, tr, STATE.turn, false);
          } else if (msg.type === 'GRAVITY3D_DROP') {
            const ty = get3DLandingHeight(msg.x, msg.z);
            if (ty !== -1) execute3DDrop(msg.x, msg.z, ty, STATE.turn, false);
          } else if (msg.type === 'ROULETTE_SHOOT') {
            executeRouletteShot(msg.target, false);
          } else if (msg.type === 'ROULETTE_ITEM') {
            // 对手使用了道具，弹出提示
            showToast(`对手使用了道具：${ROULETTE_ITEM_DEFS[msg.itemKey].name}`);
          } else if (msg.type === 'AEROPLANE_ROLL') {
            handleOnlineAeroplaneRoll(msg.player, msg.val);
          } else if (msg.type === 'AEROPLANE_MOVE') {
            executeAeroplaneMove(msg.player, msg.plane, msg.roll, false);
          } else if (msg.type === 'RESTART') {
            resetCurrentGame();
            showToast('🔄 对方重新开始了对局！');
          }
        } catch (e) {}
      });
    }

    function sendOnlineAction(data) {
      if (!STATE.online.mqttClient || !STATE.online.connected) return;
      data.sender = myClientId;
      data.game = STATE.currentGame;
      STATE.online.mqttClient.publish(`game_hall_v2/room/${STATE.online.roomId}`, JSON.stringify(data));
    }

    function createOnlineRoom() {
      AUDIO.play('click');
      const roomId = Math.floor(100000 + Math.random() * 900000).toString();
      const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?game=${STATE.currentGame.toLowerCase()}&room=${roomId}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      document.getElementById('btn-create-room').style.display = 'none';
      document.getElementById('btn-share-link').style.display = 'flex';
      resetCurrentGame();
      initMqtt(roomId, 'host');
    }

    function copyInviteLink() {
      AUDIO.play('click');
      const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?game=${STATE.currentGame.toLowerCase()}&room=${STATE.online.roomId}`;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => showToast('✅ 邀请链接已复制！快发给微信好友吧！'));
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('✅ 邀请链接已复制！快发给微信好友吧！');
      }
    }

    function promptJoinRoom() {
      AUDIO.play('click');
      const id = prompt('请输入好友分享的 6 位房间号：');
      if (id && id.trim()) {
        const cleanId = id.trim();
        const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?game=${STATE.currentGame.toLowerCase()}&room=${cleanId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        joinExistingRoom(cleanId);
      }
    }

    function joinExistingRoom(roomId) {
      document.getElementById('btn-create-room').style.display = 'none';
      document.getElementById('btn-share-link').style.display = 'none';
      resetCurrentGame();
      initMqtt(roomId, 'guest');
    }

    // ==========================================================================
    // 8. 界面与弹窗更新
    // ==========================================================================
    function updateScoreboard() {
      if (STATE.currentGame === 'AEROPLANE') {
        updateAeroplaneHUD();
        return;
      }
      const is4P = STATE.quoridor.playerCount === 4;
      const genericScoreboard = document.getElementById('generic-scoreboard');

      document.getElementById('walls-count-p1').textContent = STATE.quoridor.p1.walls;
      document.getElementById('walls-count-p2').textContent = STATE.quoridor.p2.walls;
      if (is4P) {
        document.getElementById('walls-count-p3').textContent = STATE.quoridor.p3.walls;
        document.getElementById('walls-count-p4').textContent = STATE.quoridor.p4.walls;
      }

      function renderWallBars(elemId, count, maxWalls) {
        const el = document.getElementById(elemId);
        if (!el) return;
        el.innerHTML = '';
        for (let i = 0; i < maxWalls; i++) {
          const pip = document.createElement('div');
          pip.className = 'wall-pip' + (i < count ? '' : ' used');
          el.appendChild(pip);
        }
      }

      const maxWalls = is4P ? 5 : 10;
      renderWallBars('wall-bars-p1', STATE.quoridor.p1.walls, maxWalls);
      renderWallBars('wall-bars-p2', STATE.quoridor.p2.walls, maxWalls);
      if (is4P) {
        renderWallBars('wall-bars-p3', STATE.quoridor.p3.walls, maxWalls);
        renderWallBars('wall-bars-p4', STATE.quoridor.p4.walls, maxWalls);
      }

      const card1 = document.getElementById('card-p1');
      const card2 = document.getElementById('card-p2');
      const card3 = document.getElementById('card-p3');
      const card4 = document.getElementById('card-p4');

      card1.classList.toggle('active', STATE.turn === 1);
      card2.classList.toggle('active', STATE.turn === 2);
      if (card3) card3.classList.toggle('active', STATE.turn === 3);
      if (card4) card4.classList.toggle('active', STATE.turn === 4);

      if (STATE.currentGame === 'QUORIDOR' && is4P) {
        genericScoreboard.classList.add('scoreboard-4p');
        if (card3) card3.style.display = 'flex';
        if (card4) card4.style.display = 'flex';
        document.getElementById('walls-wrapper-p3').style.display = 'block';
        document.getElementById('walls-wrapper-p4').style.display = 'block';
        document.getElementById('wall-bars-p3').style.display = 'flex';
        document.getElementById('wall-bars-p4').style.display = 'flex';
        document.getElementById('name-p1').textContent = '🔴 南门 (先手)';
        document.getElementById('name-p3').textContent = STATE.gameMode === 'AI' ? '🔵 西门 (电脑)' : '🔵 西门 (玩家3)';
        document.getElementById('name-p2').textContent = STATE.gameMode === 'AI' ? '🟢 北门 (电脑)' : '🟢 北门 (玩家2)';
        document.getElementById('name-p4').textContent = STATE.gameMode === 'AI' ? '🟡 东门 (电脑)' : '🟡 东门 (玩家4)';
      } else {
        genericScoreboard.classList.remove('scoreboard-4p');
        if (card3) card3.style.display = 'none';
        if (card4) card4.style.display = 'none';

        const isYellow = ['GRAVITY', 'GRAVITY3D', 'GRAVITY4', 'GRAVITY3D4'].includes(STATE.currentGame);
        const nameP1 = document.getElementById('name-p1');
        const nameP2 = document.getElementById('name-p2');
        if (isYellow) {
          nameP1.textContent = '🔴 红方 (先手)';
          nameP2.textContent = STATE.gameMode === 'AI' ? '🟡 黄方 (电脑)' : (STATE.gameMode === 'ONLINE' ? '🟡 黄方 (客方)' : '🟡 黄方 (后手)');
        } else {
          nameP1.textContent = '🔴 红方 (先手)';
          nameP2.textContent = STATE.gameMode === 'AI' ? '🟢 绿方 (电脑)' : (STATE.gameMode === 'ONLINE' ? '🟢 绿方 (客方)' : '🟢 绿方 (后手)');
        }
      }

      const status = document.getElementById('status-text');
      if (status) {
        status.style.display = ['QUORIDOR', 'GRAVITY', 'GRAVITY3D', 'GRAVITY4', 'GRAVITY3D4'].includes(STATE.currentGame) ? 'block' : 'none';
      }
      if (STATE.winner) {
        const isYellowGame = ['GRAVITY', 'GRAVITY3D', 'GRAVITY4', 'GRAVITY3D4'].includes(STATE.currentGame);
        const winnerNames = {
          1: '🏆 🔴 红方胜利！',
          2: isYellowGame ? '🏆 🟡 黄方胜利！' : '🏆 🟢 绿方胜利！',
          3: '🏆 🔵 蓝方胜利！',
          4: '🏆 🟡 黄方胜利！'
        };
        status.textContent = winnerNames[STATE.winner] || '🏆 对局结束！';
      } else {
        if (STATE.gameMode === 'ONLINE') {
          status.textContent = !STATE.online.opponentJoined ? '⏳ 等待好友加入房间...' : (checkIsMyTurn() ? '👉 轮到你的回合！' : '⏳ 对手思考中...');
        } else if (STATE.gameMode === 'AI') {
          const names = {
            1: '👉 轮到你行动',
            2: '🤖 🟢 绿方电脑思考中...',
            3: '🤖 🔵 蓝方电脑思考中...',
            4: '🤖 🟡 黄方电脑思考中...'
          };
          status.textContent = names[STATE.turn] || '🤖 电脑思考中...';
        } else {
          const isYellowGame2 = ['GRAVITY', 'GRAVITY3D', 'GRAVITY4', 'GRAVITY3D4'].includes(STATE.currentGame);
          const names = {
            1: '👉 轮到 🔴 红方行动',
            2: isYellowGame2 ? '👉 轮到 🟡 黄方行动' : '👉 轮到 🟢 绿方行动',
            3: '👉 轮到 🔵 蓝方行动',
            4: '👉 轮到 🟡 黄方行动'
          };
          status.textContent = names[STATE.turn] || '👉 轮到当前玩家行动';
        }
      }
    }

    function showModal(title, bodyHtml) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = bodyHtml;
      document.getElementById('game-modal').classList.add('show');
    }

    function showCurrentRules() {
      AUDIO.play('click');
      const gameKey = STATE.currentView === 'LOBBY' ? 'LOBBY' : STATE.currentGame;
      if (gameKey === 'QUORIDOR') {
        showModal('步步为营 (Quoridor 4P) 规则', `
          <p><strong>胜利目标：</strong>率先到达自己对向的胜利线（🔴南冲北、🟢北冲南、🔵西冲东、🟡东冲西）！</p><br>
          <p><strong>挡板分配：</strong>双人局各 10 块；四人局各 5 块！放板必须为所有玩家至少留一条活路！</p><br>
          <p><strong>跳跃规则：</strong>面对邻格棋子可直线跳过；若正向受阻或有墙，可向侧方斜跳！</p><br>
          <p><strong>轮替顺序：</strong>顺时针依次行动（🔴P1 -> 🔵P3 -> 🟢P2 -> 🟡P4）！</p>
        `);
      } else if (gameKey === 'AEROPLANE') {
        showModal('✈️ 四人飞行棋 (Aeroplane Chess 4P) 规则', `
          <p><strong>胜利目标：</strong>率先将己方全部 4 架战机巡航抵达中央大本营终点者夺得冠军！</p><br>
          <p><strong>起飞规则：</strong>战机在停机坪待命，必须掷出 <b>6 点</b> 方可起飞至起始跑道出战。</p><br>
          <p><strong>连掷奖励：</strong>掷出 6 点可获得再掷一次机会！但若<b>连续 3 次掷出 6 点</b>，将触发发动机过热警报坠机返航！</p><br>
          <p><strong>同色跳跃：</strong>战机在外圈公用航线停留在与自身颜色相同的格子上，可直接向前<b>超速跳跃 4 格</b>！</p><br>
          <p><strong>超速飞越：</strong>停在己方飞越跑道（相对第16格），可沿中央虚线<b>径直横跨整个棋盘</b>（直飞12格），击落中心敌机，着陆后再跳跃4格！</p><br>
          <p><strong>空中撞机：</strong>停留在敌方战机所在格，直接将敌机<b>击落遣返停机坪</b>！同色战机在同格则触发<b>叠机编队</b>！</p><br>
          <p><strong>精准冲线：</strong>进入终点直道后必须<b>刚好掷出对应点数</b>到达中央大本营。超出点数将折返倒退！</p><br>
          <p><strong>多种模式：</strong>支持 1人挑战3电脑 AI、本地2-4人同屏轮流对战、以及好友联机房间！</p>
        `);
      } else if (gameKey === 'GRAVITY') {
        showModal('重力五子棋 (2D) 规则', `
          <p><strong>重力下落：</strong>点击任意一列，棋子受重力自然滑落堆叠到底部。</p><br>
          <p><strong>胜利目标：</strong>在横向、纵向或对角线连成 <b>5 颗连续同色棋子</b> 者获胜！</p><br>
          <p><strong>核心博弈：</strong>棋子无法悬空停留，小心别给对手送出"垫脚石"！</p>
        `);
      } else if (gameKey === 'GRAVITY4') {
        showModal('🟡 重力四子棋 (Connect Four) 规则', `
          <p><strong>经典玩法：</strong>7列×6行棋盘，点击列号按钮投子，棋子受重力滑落堆叠。</p><br>
          <p><strong>胜利目标：</strong>率先在横向、纵向或对角线连成 <b>4 颗连续同色棋子</b> 者获胜！</p><br>
          <p><strong>核心博弈：</strong>经典博弈名局！每一步都是攻防兼备，比五子棋更快节奏！</p>
        `);
      } else if (gameKey === 'GRAVITY3D') {
        showModal('3D 立体五子棋 规则', `
          <p><strong>三维空间结构：</strong>底座立有 5x5 共 25 根立柱，每根柱子最多串 5 颗珠子（共 125 个空间节点）。</p><br>
          <p><strong>视角操作：</strong>鼠标按住/单指滑动可 <b>360° 旋转视角</b>，滚轮/双指可缩放，点击立柱即可投子。</p><br>
          <p><strong>13 维空间获胜：</strong>率先在任意方向连成 <b>5 颗珠子直线</b>（包括垂直线、平面横纵线、平面斜线，以及贯穿整个立方体的 <b>4 条空间大对角线</b>）者获胜！</p>
        `);
      } else if (gameKey === 'GRAVITY3D4') {
        showModal('💜 3D 立体四子棋 规则', `
          <p><strong>三维结构：</strong>4×4×4 三维魔方棋盘，共 16 根立柱，每柱最多 4 颗珠子（64 个空间节点）。</p><br>
          <p><strong>胜利目标：</strong>率先连成 <b>4 颗空间直线</b> 者获胜！共有 <b>76 条</b> 可能的胜利线（含空间对角线）！</p><br>
          <p><strong>视角操作：</strong>拖拽旋转视角，点击立柱落子。比 3D 五子棋更快节奏，超高烧脑指数！</p>
        `);
      } else if (gameKey === 'ROULETTE') {
        showModal('恶魔轮盘赌 规则', `
          <p><strong>枪膛与子弹：</strong>每轮装入已知数量的 🔴 实弹 与 ⚪ 空包弹，轮流开枪。</p><br>
          <p><strong>核心机制：</strong></p>
          <ul>
            <li><b>开枪打对手：</b>若是实弹扣除对方生命值；若是空包弹则安然无恙并换对手回合。</li>
            <li><b>开枪打自己：</b>若是空包弹，<b>你将获得额外一次行动回合！</b> 若是实弹则扣自己血。</li>
          </ul><br>
          <p><strong>道具功效：</strong>🔍 放大镜看下一发真假；🔒 手铐锁住对手下回合；🪚 手锯造成2倍实弹伤害；🍺 啤酒退出一发弹；🚬 香烟回血。</p>
        `);
      } else if (gameKey === 'HOCKEY') {
        showModal('极光空气冰球 规则', `
          <p><strong>碰撞竞技：</strong>滑动己方推盘，利用刚体弹力高速撞击发光的冰球！</p><br>
          <p><strong>破门得分：</strong>先将冰球攻入对方球门达到 <b>5 分</b> 的玩家赢得总冠军！</p>
        `);
      } else if (gameKey === 'IAIDO') {
        showModal('拔刀居合斩 规则', `
          <p><strong>屏息凝神：</strong>屏幕变暗等待，切勿提前触碰，<strong>抢跑直接判负！</strong></p><br>
          <p><strong>一击必杀：</strong>红光闪现「斬」字瞬间，以极限手速点击屏幕，快 1 毫秒者胜！率先赢下 3 胜者问鼎剑圣！</p>
        `);
      } else if (gameKey === 'LIARSDICE') {
        showModal('皇家大话骰 规则', `
          <p><strong>叫牌规则：</strong>双方暗摇5颗骰子，轮流报点。下一个人的叫牌必须【个数更多】或【点数更大】！</p><br>
          <p><strong>万能1点：</strong>1点可代表任意点数（除非场上有人叫过1点）。</p><br>
          <p><strong>当场质疑：</strong>觉得对方在吹牛虚报？直接喊「开」！算错者扣1点生命，扣完淘汰！</p>
        `);
      } else if (gameKey === 'SUMO') {
        showModal('🚗 物理飞车相扑 规则与操作指南', `
          <p><strong>极限推土机：</strong>在圆形空中悬浮擂台上，按住【冲刺】推撞对手，松开自动转弯瞄准！</p><br>
          <p><strong>双人同屏对战：</strong>支持在手机或电脑同屏激战！</p>
          <ul>
            <li><b>🔴 玩家 1 (红车)：</b>按住下方红键、触碰屏幕左半侧、或键盘按 <b>W / A / S / D / 空格键</b> 冲刺！</li>
            <li><b>🔵 玩家 2 (蓝车)：</b>按住下方蓝键、触碰屏幕右半侧、或键盘按 <b>方向键 / 回车 / L 键</b> 冲刺！</li>
          </ul><br>
          <p><strong>坠落深渊：</strong>利用动量冲撞把对方顶出擂台边缘即可得分，抢先得 <b>3 分</b> 者夺得总冠军！</p>
        `);
      } else if (gameKey === 'TANK') {
        showModal('极限抛物线 规则', `
          <p><strong>弹道对轰：</strong>观察上方【实时风向与风速】，拖动滑杆调节发射【角度】与【力度】！</p><br>
          <p><strong>地形破坏：</strong>炮弹击中地面会炸出凹陷弹坑，直接命中或爆炸溅射直接扣除坦克生命！</p>
        `);
      } else if (gameKey === 'STACK') {
        showModal('极光叠叠高 规则', `
          <p><strong>节奏切割：</strong>轻触屏幕让横飞的方块落下。对齐严丝合缝触发【PERFECT音阶连击】！</p><br>
          <p><strong>削切缩小：</strong>没对齐的多余边缘会被一刀切掉，底座越来越窄，一旦切空整座塔彻底倒塌！</p>
        `);
      } else if (gameKey === 'CONTRA') {
        showModal('💥 魂斗罗 (Contra: 丛林突袭) 规则与秘籍', `
          <p><strong>经典操作：</strong>【W/A/S/D 或 摇杆】8向移动与瞄准；【J / 空格 / B键】开火；【K / A键】跳跃；【S / 下键】趴下躲子弹！鼠标轻触画面亦可直接开火！</p><br>
          <p><strong>神级装备：</strong>击碎天上飞行的红白胶囊，抢夺 <b>🔴 S 弹 (5向扇形扩散弹)</b>、<b>🟡 M 机枪 (连发扫射)</b> 或 <b>🔵 L 激光 (高能贯穿)</b>！</p><br>
          <p><strong>第一关要塞 BOSS：</strong>抵达最右侧基地防线，击破双联装转管炮台与高空狙击手，集火轰爆中央红色感应核心！</p><br>
          <p><strong>经典秘籍：</strong>右上角常驻点击 <b>【⚡ 30 条命】</b>，一秒梦回童年红白机！</p>
        `);
      } else if (gameKey === 'TANKTROUBLE') {
        showModal('🛡️ 坦克震荡 (Tank Trouble) 规则与指南', `
          <p><strong>胜利目标：</strong>在不断随机生成的错综复杂迷宫中穿梭对轰，率先击毁敌方坦克达到 <b>5 分</b> 者获得总冠军！</p><br>
          <p><strong>💥 物理反弹穿甲炮弹（无差别伤害）：</strong></p>
          <ul>
            <li>发射的炮弹可在迷宫坚硬墙壁间连续高速反弹 <b>7 次</b>，反射角精确等于入射角！</li>
            <li><b>切记小心跳弹：</b>自己的炮弹反弹回来击中自己同样会粉身碎骨，切勿盲目乱射！</li>
            <li>每辆坦克最多维持 <b>5 枚</b> 活跃炮弹，冷却完毕即可持续压制。</li>
          </ul><br>
          <p><strong>🎮 全端操作方案（完全还原经典与双人同屏）：</strong></p>
          <ul>
            <li><b>🔴 玩家 1 (红坦克)：</b>键盘 <b>ESDF</b> 移动（E前进、D后退、S左转、F右转），<b>Q</b> 键发射！（亦智能兼容 <b>WASD + 空格</b>）</li>
            <li><b>🟢 玩家 2 (绿坦克)：</b>键盘方向键 <b>↑ ↓ ← →</b> 移动，<b>M</b> 键发射！（亦支持 Enter 键）</li>
            <li><b>🔵 玩家 3 (蓝坦克)：</b>鼠标移动光标控制朝向与移动，<b>鼠标左键</b> 发射！</li>
            <li><b>📱 移动端触屏：</b>双人同屏提供专属左右独立虚拟十字轮盘与发光开火键！</li>
          </ul>
        `);
      } else {
        showModal('聚会大厅 指南', `
          <p>欢迎来到 <b>聚会游戏大厅 (Party Arcade)</b>！</p><br>
          <p>点击任意游戏卡片即可直接开玩，支持人机对战、双人同屏以及好友微信/QQ链接联机！随时可点击左上角返回大厅挑选更多游戏。</p>
        `);
      }
    }

    
    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('HOCKEY');
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
