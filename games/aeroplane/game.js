// ==========================================================================
// ✈️ 四人飞行棋 (Aeroplane Chess 4P) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'AEROPLANE';
window.GAME_RULES = {
  'AEROPLANE': {"title":"✈️ 四人飞行棋 (Aeroplane Chess 4P) 规则","body":"<p><strong>胜利目标：</strong>率先将己方全部 4 架战机巡航抵达中央大本营终点者夺得冠军！</p><br>\n           <p><strong>起飞规则：</strong>战机在停机坪待命，必须掷出 <b>6 点</b> 方可起飞至起始跑道出战。</p><br>\n           <p><strong>连掷奖励：</strong>掷出 6 点可获得再掷一次机会！但若<b>连续 3 次掷出 6 点</b>，将触发发动机过热警报坠机返航！</p><br>\n           <p><strong>同色跳跃：</strong>战机在外圈公用航线停留在与自身颜色相同的格子上，可直接向前<b>超速跳跃 4 格</b>！</p><br>\n           <p><strong>超速飞越：</strong>停在己方飞越跑道（相对第16格），可沿中央虚线<b>径直横跨整个棋盘</b>（直飞12格），击落中心敌机，着陆后再跳跃4格！</p><br>\n           <p><strong>空中撞机：</strong>停留在敌方战机所在格，直接将敌机<b>击落遣返停机坪</b>！同色战机在同格则触发<b>叠机编队</b>！</p><br>\n           <p><strong>精准冲线：</strong>进入终点直道后必须<b>刚好掷出对应点数</b>到达中央大本营。超出点数将折返倒退！</p><br>\n           <p><strong>多种模式：</strong>支持 1人挑战3电脑 AI、本地2-4人同屏轮流对战、以及好友联机房间！</p>"}
};

const STATE = {

      currentGame: 'AEROPLANE',
      gameMode: 'AI',
      turn: 0,
      winner: null,
      animating: false,
      online: { roomId: null, myRole: null, connected: false, mqttClient: null, opponentJoined: false },
      aeroplane: {
        playerCount: 4,
        humanPlayers: [0],
        turn: 0,
        diceVal: 0,
        diceRolling: false,
        consecutiveSixes: 0,
        animating: false,
        selectedPlane: null,
        validPlanes: [],
        fastAI: false,
        waitingForPlayerChoice: false,
        players: [
          { id: 0, color: '#ef4444', name: '红方', finishedCount: 0, planes: [{ id: 0, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 1, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 2, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 3, state: 'HANGAR', step: 0, homeStep: -1 }] },
          { id: 1, color: '#f59e0b', name: '黄方', finishedCount: 0, planes: [{ id: 0, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 1, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 2, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 3, state: 'HANGAR', step: 0, homeStep: -1 }] },
          { id: 2, color: '#38bdf8', name: '蓝方', finishedCount: 0, planes: [{ id: 0, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 1, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 2, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 3, state: 'HANGAR', step: 0, homeStep: -1 }] },
          { id: 3, color: '#22c55e', name: '绿方', finishedCount: 0, planes: [{ id: 0, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 1, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 2, state: 'HANGAR', step: 0, homeStep: -1 }, { id: 3, state: 'HANGAR', step: 0, homeStep: -1 }] }
        ],
        particles: [],
        animId: null,
        aiTimer: null
      }
    
};
window.STATE = STATE;

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
  resetAeroplaneGame();
}

// --- 游戏专属引擎核心逻辑 ---
// 13. 四人飞行棋游戏引擎 (AEROPLANE CHESS 4P)
    // ==========================================================================
    const AERO_CELL_SIZE = 32;
    const AERO_BOARD_SIZE = 15;
    const AERO_LAUNCH_TILES = [0, 13, 26, 39]; // 红、黄、蓝、绿
    const AERO_COLOR_NAMES = ['红方', '黄方', '蓝方', '绿方'];
    const AERO_COLOR_HEX = ['#ef4444', '#f59e0b', '#38bdf8', '#22c55e'];
    const AERO_COLOR_GLOWS = ['rgba(239,68,68,0.6)', 'rgba(245,158,11,0.6)', 'rgba(56,189,248,0.6)', 'rgba(34,197,94,0.6)'];

    // 52个外圈跑道坐标
    const AERO_TRACK_TILES = (function() {
      let q0 = [];
      for (let c = 5; c >= 0; c--) q0.push({ r: 8, c });
      q0.push({ r: 7, c: 0 });
      for (let c = 0; c <= 5; c++) q0.push({ r: 6, c });

      let q1 = [];
      for (let r = 5; r >= 0; r--) q1.push({ r, c: 6 });
      q1.push({ r: 0, c: 7 });
      for (let r = 0; r <= 5; r++) q1.push({ r, c: 8 });

      let q2 = [];
      for (let c = 9; c <= 14; c++) q2.push({ r: 6, c });
      q2.push({ r: 7, c: 14 });
      for (let c = 14; c >= 9; c--) q2.push({ r: 8, c });

      let q3 = [];
      for (let r = 9; r <= 14; r++) q3.push({ r, c: 8 });
      q3.push({ r: 14, c: 7 });
      for (let r = 14; r >= 9; r--) q3.push({ r, c: 6 });

      return [...q0, ...q1, ...q2, ...q3];
    })();

    // 4条终点直道 (5格跑道 + 1格中央胜利大本营)
    const AERO_HOME_PATHS = [
      [ { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }, { r: 7, c: 7 } ],
      [ { r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }, { r: 7, c: 7 } ],
      [ { r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }, { r: 7, c: 7 } ],
      [ { r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }, { r: 7, c: 7 } ]
    ];

    // 停机坪4个机位坐标
    const AERO_HANGAR_BAYS = [
      [ { x: 68, y: 356 }, { x: 124, y: 356 }, { x: 68, y: 412 }, { x: 124, y: 412 } ],
      [ { x: 68, y: 68 }, { x: 124, y: 68 }, { x: 68, y: 124 }, { x: 124, y: 124 } ],
      [ { x: 356, y: 68 }, { x: 412, y: 68 }, { x: 356, y: 124 }, { x: 412, y: 124 } ],
      [ { x: 356, y: 356 }, { x: 412, y: 356 }, { x: 356, y: 412 }, { x: 412, y: 412 } ]
    ];

    let aeroCanvasListenerBound = false;

    function getAeroGridPixel(r, c) {
      return {
        x: c * AERO_CELL_SIZE + AERO_CELL_SIZE / 2,
        y: r * AERO_CELL_SIZE + AERO_CELL_SIZE / 2
      };
    }

    function initAeroplaneGame() {
      AUDIO.init();
      const canvas = document.getElementById('aeroplane-canvas');
      if (canvas && !aeroCanvasListenerBound) {
        canvas.addEventListener('click', handleAeroplaneCanvasClick);
        aeroCanvasListenerBound = true;
      }
      resizeAeroplaneCanvas();
      updateAeroplaneHUD();

      if (STATE.aeroplane.animId) cancelAnimationFrame(STATE.aeroplane.animId);
      renderAeroplane();

      const curPlayer = STATE.aeroplane.turn;
      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      if (!isHuman && !STATE.aeroplane.diceRolling && !STATE.aeroplane.animating) {
        runAeroplaneAI();
      }
    }

    function resetAeroplaneGame() {
      if (STATE.aeroplane.animId) cancelAnimationFrame(STATE.aeroplane.animId);
      if (STATE.aeroplane.aiTimer) clearTimeout(STATE.aeroplane.aiTimer);

      STATE.aeroplane.turn = 0;
      STATE.turn = 1;
      STATE.winner = null;
      STATE.aeroplane.diceVal = 0;
      STATE.aeroplane.diceRolling = false;
      STATE.aeroplane.consecutiveSixes = 0;
      STATE.aeroplane.animating = false;
      STATE.aeroplane.waitingForPlayerChoice = false;
      STATE.aeroplane.validPlanes = [];
      STATE.aeroplane.particles = [];

      for (let p = 0; p < 4; p++) {
        const player = STATE.aeroplane.players[p];
        player.finishedCount = 0;
        player.planes.forEach(pl => {
          pl.state = 'HANGAR';
          pl.step = 0;
          pl.homeStep = -1;
          delete pl.animX;
          delete pl.animY;
          delete pl.animAngle;
        });
      }

      const picker = document.getElementById('aero-plane-picker');
      if (picker) picker.style.display = 'none';
      const promptEl = document.getElementById('aero-prompt');
      if (promptEl) promptEl.textContent = '🔴 红方回合：请点击掷骰子';
      const pipText = document.getElementById('dice-pip-text');
      if (pipText) pipText.textContent = '🎲';
      const btnRoll = document.getElementById('btn-aero-roll');
      if (btnRoll) btnRoll.disabled = false;

      updateAeroplaneHUD();
      renderAeroplane();

      if (!STATE.aeroplane.humanPlayers.includes(0)) {
        runAeroplaneAI();
      }
    }

    function resizeAeroplaneCanvas() {
      const c = document.getElementById('aeroplane-canvas');
      if (!c) return;
      const stage = document.querySelector('.stage-wrapper');
      const w = stage ? Math.min(480, stage.clientWidth - 12) : 480;
      c.style.width = w + 'px';
      c.style.height = w + 'px';
      const dpr = window.devicePixelRatio || 1;
      c.width = 480 * dpr;
      c.height = 480 * dpr;
      const ctx = c.getContext('2d');
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }

    function updateAeroplaneHUD() {
      for (let i = 0; i < 4; i++) {
        const card = document.getElementById(`aero-card-${i}`);
        const role = document.getElementById(`aero-role-${i}`);
        const stats = document.getElementById(`aero-stats-${i}`);
        const isCur = STATE.aeroplane.turn === i && !STATE.winner;
        if (card) card.classList.toggle('active', isCur);
        const isHuman = STATE.aeroplane.humanPlayers.includes(i);
        if (role) role.textContent = isHuman ? '玩家' : '电脑';

        const p = STATE.aeroplane.players[i];
        const inHangar = p.planes.filter(pl => pl.state === 'HANGAR').length;
        if (stats) {
          stats.textContent = `待机:${inHangar} · 🏁 ${p.finishedCount}/4`;
        }
      }

      const curPlayer = STATE.aeroplane.turn;
      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      const btnRoll = document.getElementById('btn-aero-roll');
      if (btnRoll) {
        btnRoll.disabled = !isHuman || STATE.aeroplane.animating || STATE.aeroplane.diceRolling || STATE.aeroplane.waitingForPlayerChoice || !!STATE.winner;
      }
    }

    function handleAeroCardClick(pIdx) {
      if (STATE.aeroplane.humanPlayers.includes(pIdx)) {
        if (STATE.aeroplane.humanPlayers.length > 1) {
          STATE.aeroplane.humanPlayers = STATE.aeroplane.humanPlayers.filter(idx => idx !== pIdx);
          showToast(`🟡 ${AERO_COLOR_NAMES[pIdx]} 改为电脑 AI 控制`);
        } else {
          showToast('⚠️ 至少需要保留 1 名玩家！');
        }
      } else {
        STATE.aeroplane.humanPlayers.push(pIdx);
        STATE.aeroplane.humanPlayers.sort();
        showToast(`👤 ${AERO_COLOR_NAMES[pIdx]} 改为玩家控制`);
      }
      updateAeroplaneHUD();
      if (!STATE.aeroplane.humanPlayers.includes(STATE.aeroplane.turn) && !STATE.aeroplane.animating && !STATE.aeroplane.diceRolling) {
        runAeroplaneAI();
      }
    }

    function setAeroplaneHumans(num) {
      AUDIO.play('click');
      const chip1 = document.getElementById('chip-mode-1p');
      const chip2 = document.getElementById('chip-mode-2p');
      const chip4 = document.getElementById('chip-mode-4p');
      if (chip1) chip1.classList.toggle('active', num === 1);
      if (chip2) chip2.classList.toggle('active', num === 2);
      if (chip4) chip4.classList.toggle('active', num === 4);

      if (num === 1) STATE.aeroplane.humanPlayers = [0];
      else if (num === 2) STATE.aeroplane.humanPlayers = [0, 1];
      else if (num === 4) STATE.aeroplane.humanPlayers = [0, 1, 2, 3];

      updateAeroplaneHUD();
      showToast(num === 1 ? '👤 切换为：1人挑战3电脑' : (num === 2 ? '👥 切换为：2人同屏对战' : '👥👥 切换为：4人同屏混战'));
      if (!STATE.aeroplane.humanPlayers.includes(STATE.aeroplane.turn) && !STATE.aeroplane.diceRolling && !STATE.aeroplane.animating) {
        runAeroplaneAI();
      }
    }

    function toggleAeroplaneFastAI() {
      AUDIO.play('click');
      STATE.aeroplane.fastAI = !STATE.aeroplane.fastAI;
      const chip = document.getElementById('chip-fast-ai');
      if (chip) {
        chip.textContent = STATE.aeroplane.fastAI ? '⚡ 极速AI: 开' : '⚡ 极速AI: 关';
        chip.classList.toggle('active', STATE.aeroplane.fastAI);
      }
      showToast(STATE.aeroplane.fastAI ? '⚡ 极速模式已开启 (快速对决)' : '⏱️ 极速模式已关闭');
    }

    function handleAeroplaneCanvasClick(e) {
      if (STATE.winner || STATE.aeroplane.animating || STATE.aeroplane.diceRolling) return;
      const curPlayer = STATE.aeroplane.turn;
      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      if (!isHuman) return;

      const canvas = document.getElementById('aeroplane-canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = 480 / rect.width;
      const scaleY = 480 / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // 骰子尚未掷出时，点击中央区域可直接掷骰
      if (STATE.aeroplane.diceVal === 0) {
        triggerAeroplaneRoll();
        return;
      }

      // 等待选择战机时，点击对应战机即可移动
      if (STATE.aeroplane.waitingForPlayerChoice && STATE.aeroplane.validPlanes.length > 0) {
        let bestPlane = -1;
        let minDist = 32;
        const player = STATE.aeroplane.players[curPlayer];
        STATE.aeroplane.validPlanes.forEach(pIdx => {
          const pos = getPlanePosition(curPlayer, player.planes[pIdx]);
          const d = Math.hypot(clickX - pos.x, clickY - pos.y);
          if (d < minDist) {
            minDist = d;
            bestPlane = pIdx;
          }
        });
        if (bestPlane !== -1) {
          selectAeroplanePlane(bestPlane);
        }
      }
    }

    function triggerAeroplaneRoll() {
      if (STATE.winner || STATE.aeroplane.animating || STATE.aeroplane.diceRolling || STATE.aeroplane.waitingForPlayerChoice) return;
      const curPlayer = STATE.aeroplane.turn;
      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      if (!isHuman) return;

      rollAeroplaneDice(val => {
        handleDiceRollResult(val);
      });
    }

    function rollAeroplaneDice(callback) {
      STATE.aeroplane.diceRolling = true;
      AUDIO.play('dice_shake');
      const diceEl = document.getElementById('aero-dice');
      const pipText = document.getElementById('dice-pip-text');
      if (diceEl) diceEl.classList.add('rolling');

      const pips = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      let ticks = 0;
      const rollInterval = setInterval(() => {
        ticks++;
        if (pipText) pipText.textContent = pips[Math.floor(Math.random() * 6)];
        if (ticks >= 8) {
          clearInterval(rollInterval);
          if (diceEl) diceEl.classList.remove('rolling');
          const finalVal = Math.floor(Math.random() * 6) + 1;
          STATE.aeroplane.diceVal = finalVal;
          if (pipText) pipText.textContent = pips[finalVal - 1];
          AUDIO.play('cup_slam');
          STATE.aeroplane.diceRolling = false;

          if (STATE.gameMode === 'ONLINE' && STATE.online.roomId) {
            sendOnlineAction({ type: 'AEROPLANE_ROLL', player: STATE.aeroplane.turn, val: finalVal });
          }

          if (callback) callback(finalVal);
        }
      }, 50);
    }

    function handleOnlineAeroplaneRoll(pIdx, val) {
      STATE.aeroplane.turn = pIdx;
      STATE.aeroplane.diceVal = val;
      const pips = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      const pipText = document.getElementById('dice-pip-text');
      if (pipText) pipText.textContent = pips[val - 1];
      AUDIO.play('cup_slam');
      handleDiceRollResult(val);
    }

    function getValidAeroplanePlanes(playerIdx, roll) {
      const player = STATE.aeroplane.players[playerIdx];
      const valid = [];
      player.planes.forEach((p, idx) => {
        if (p.state === 'FINISHED') return;
        if (p.state === 'HANGAR') {
          if (roll === 6) valid.push(idx);
        } else {
          valid.push(idx);
        }
      });
      return valid;
    }

    function handleDiceRollResult(roll) {
      const curPlayer = STATE.aeroplane.turn;
      const player = STATE.aeroplane.players[curPlayer];
      const promptEl = document.getElementById('aero-prompt');
      const validPlanes = getValidAeroplanePlanes(curPlayer, roll);
      STATE.aeroplane.validPlanes = validPlanes;

      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      const isFast = STATE.aeroplane.fastAI;

      if (validPlanes.length === 0) {
        if (promptEl) promptEl.textContent = `${AERO_COLOR_NAMES[curPlayer]} 掷出 ${roll} 点，无法起飞或移动`;
        const delay = isFast ? 250 : 800;
        setTimeout(() => {
          finishAeroplaneTurn(false);
        }, delay);
        return;
      }

      if (validPlanes.length === 1) {
        const pIdx = validPlanes[0];
        if (promptEl) {
          promptEl.textContent = `${AERO_COLOR_NAMES[curPlayer]} 掷出 ${roll} 点！即将移动 ${pIdx + 1}号战机`;
        }
        const delay = isHuman ? (isFast ? 250 : 600) : (isFast ? 150 : 450);
        setTimeout(() => {
          executeAeroplaneMove(curPlayer, pIdx, roll, true);
        }, delay);
        return;
      }

      // 多架战机可选
      if (isHuman) {
        STATE.aeroplane.waitingForPlayerChoice = true;
        if (promptEl) {
          promptEl.textContent = `🎉 掷出 ${roll} 点！请点击棋盘或下方按钮选择战机`;
        }
        renderAeroplanePicker(validPlanes, roll);
      } else {
        // AI 策略打分选出最佳战机
        const bestIdx = chooseBestAeroplaneMove(player, roll, validPlanes);
        if (promptEl) {
          promptEl.textContent = `🤖 ${AERO_COLOR_NAMES[curPlayer]} 思考后选择出击 ${bestIdx + 1}号战机`;
        }
        const delay = isFast ? 150 : 450;
        setTimeout(() => {
          executeAeroplaneMove(curPlayer, bestIdx, roll, true);
        }, delay);
      }
    }

    function renderAeroplanePicker(validPlanes, roll) {
      const picker = document.getElementById('aero-plane-picker');
      const container = document.getElementById('aero-picker-buttons');
      if (!picker || !container) return;
      container.innerHTML = '';
      const curPlayer = STATE.aeroplane.turn;
      const player = STATE.aeroplane.players[curPlayer];

      validPlanes.forEach(pIdx => {
        const p = player.planes[pIdx];
        let label = '';
        if (p.state === 'HANGAR') label = '出库起飞 🛫';
        else if (p.state === 'HOMEPATH') label = `直道冲线 +${roll}格 🏁`;
        else label = `航线推进 +${roll}格 🚀`;

        const btn = document.createElement('button');
        btn.className = 'btn-plane-choice';
        btn.textContent = `✈️ ${pIdx + 1}号机 (${label})`;
        btn.onclick = () => selectAeroplanePlane(pIdx);
        container.appendChild(btn);
      });
      picker.style.display = 'flex';
    }

    function selectAeroplanePlane(planeIdx) {
      if (!STATE.aeroplane.waitingForPlayerChoice) return;
      STATE.aeroplane.waitingForPlayerChoice = false;
      const picker = document.getElementById('aero-plane-picker');
      if (picker) picker.style.display = 'none';
      executeAeroplaneMove(STATE.aeroplane.turn, planeIdx, STATE.aeroplane.diceVal, true);
    }

    function chooseBestAeroplaneMove(player, roll, validPlanes) {
      let bestIdx = validPlanes[0];
      let bestScore = -Infinity;

      for (const pIdx of validPlanes) {
        const p = player.planes[pIdx];
        let score = 0;

        if (p.state === 'HANGAR') {
          const outCount = player.planes.filter(pl => pl.state === 'TRACK' || pl.state === 'HOMEPATH').length;
          score = 140 - outCount * 25;
          const launchTile = AERO_LAUNCH_TILES[player.id];
          if (hasOpponentOnTrackTile(launchTile, player.id)) score += 500;
        } else if (p.state === 'HOMEPATH') {
          const target = p.homeStep + roll;
          if (target === 5) score += 1200; // 进终点
          else if (target > 5) score += 50 - (target - 5) * 20; // 弹回
          else score += 300 + target * 40;
        } else if (p.state === 'TRACK') {
          const nextStep = p.step + roll;
          if (nextStep >= 50) {
            const home = nextStep - 50;
            if (home === 5) score += 1200;
            else score += 400 + home * 30;
          } else {
            const absTile = (AERO_LAUNCH_TILES[player.id] + nextStep) % 52;
            const ownColor = absTile % 4 === player.id;
            if (ownColor) {
              if (nextStep === 16) score += 600; // 超速飞越
              else score += 350; // 同色跳跃
            } else {
              score += nextStep * 3;
            }
            if (hasOpponentOnTrackTile(absTile, player.id)) score += 550; // 撞机
          }
        }

        score += Math.random() * 8; // 随机微调打散
        if (score > bestScore) {
          bestScore = score;
          bestIdx = pIdx;
        }
      }
      return bestIdx;
    }

    function hasOpponentOnTrackTile(absTile, myPlayerId) {
      for (let p = 0; p < 4; p++) {
        if (p === myPlayerId) continue;
        const opp = STATE.aeroplane.players[p];
        for (const pl of opp.planes) {
          if (pl.state === 'TRACK') {
            const oppAbs = (AERO_LAUNCH_TILES[p] + pl.step) % 52;
            if (oppAbs === absTile) return true;
          }
        }
      }
      return false;
    }

    function executeAeroplaneMove(playerIdx, planeIdx, roll, isLocalAction = true) {
      STATE.aeroplane.animating = true;
      STATE.aeroplane.waitingForPlayerChoice = false;
      const picker = document.getElementById('aero-plane-picker');
      if (picker) picker.style.display = 'none';

      if (isLocalAction && STATE.gameMode === 'ONLINE' && STATE.online.roomId) {
        sendOnlineAction({ type: 'AEROPLANE_MOVE', player: playerIdx, plane: planeIdx, roll });
      }

      const player = STATE.aeroplane.players[playerIdx];
      const plane = player.planes[planeIdx];

      // 构建动画途径路点列表
      const waypoints = [];
      let finalState = plane.state;
      let finalStep = plane.step;
      let finalHomeStep = plane.homeStep;
      let triggeredShortcut = false;
      let triggeredJump = false;

      if (plane.state === 'HANGAR') {
        finalState = 'TRACK';
        finalStep = 0;
        finalHomeStep = -1;
        const launchPos = getAeroGridPixel(AERO_TRACK_TILES[AERO_LAUNCH_TILES[playerIdx]].r, AERO_TRACK_TILES[AERO_LAUNCH_TILES[playerIdx]].c);
        waypoints.push(launchPos);
      } else if (plane.state === 'TRACK') {
        for (let s = plane.step + 1; s <= plane.step + roll; s++) {
          if (s < 50) {
            const tile = AERO_TRACK_TILES[(AERO_LAUNCH_TILES[playerIdx] + s) % 52];
            waypoints.push(getAeroGridPixel(tile.r, tile.c));
          } else {
            const h = s - 50;
            if (h <= 5) {
              const tile = AERO_HOME_PATHS[playerIdx][h];
              waypoints.push(getAeroGridPixel(tile.r, tile.c));
            } else {
              const b = 5 - (h - 5);
              const tile = AERO_HOME_PATHS[playerIdx][b];
              waypoints.push(getAeroGridPixel(tile.r, tile.c));
            }
          }
        }

        const landingStep = plane.step + roll;
        if (landingStep < 50) {
          finalState = 'TRACK';
          finalStep = landingStep;
          finalHomeStep = -1;
          const abs = (AERO_LAUNCH_TILES[playerIdx] + landingStep) % 52;
          if (abs % 4 === playerIdx) {
            if (landingStep === 16) {
              triggeredShortcut = true;
              // 飞越航线 16 -> 28 -> 32
              const tile28 = AERO_TRACK_TILES[(AERO_LAUNCH_TILES[playerIdx] + 28) % 52];
              waypoints.push(getAeroGridPixel(tile28.r, tile28.c));
              for (let s = 29; s <= 32; s++) {
                const t = AERO_TRACK_TILES[(AERO_LAUNCH_TILES[playerIdx] + s) % 52];
                waypoints.push(getAeroGridPixel(t.r, t.c));
              }
              finalStep = 32;
            } else {
              triggeredJump = true;
              for (let s = landingStep + 1; s <= landingStep + 4; s++) {
                if (s < 50) {
                  const t = AERO_TRACK_TILES[(AERO_LAUNCH_TILES[playerIdx] + s) % 52];
                  waypoints.push(getAeroGridPixel(t.r, t.c));
                } else {
                  const h = s - 50;
                  const t = AERO_HOME_PATHS[playerIdx][h <= 5 ? h : 5 - (h - 5)];
                  waypoints.push(getAeroGridPixel(t.r, t.c));
                }
              }
              if (landingStep + 4 < 50) {
                finalStep = landingStep + 4;
              } else {
                finalState = 'HOMEPATH';
                const h = landingStep + 4 - 50;
                finalHomeStep = h <= 5 ? h : 5 - (h - 5);
              }
            }
          }
        } else {
          finalState = 'HOMEPATH';
          const h = landingStep - 50;
          if (h === 5) {
            finalState = 'FINISHED';
            finalHomeStep = 5;
          } else if (h > 5) {
            finalHomeStep = 5 - (h - 5);
          } else {
            finalHomeStep = h;
          }
        }
      } else if (plane.state === 'HOMEPATH') {
        finalState = 'HOMEPATH';
        for (let s = plane.homeStep + 1; s <= plane.homeStep + roll; s++) {
          if (s <= 5) {
            const tile = AERO_HOME_PATHS[playerIdx][s];
            waypoints.push(getAeroGridPixel(tile.r, tile.c));
          } else {
            const b = 5 - (s - 5);
            const tile = AERO_HOME_PATHS[playerIdx][b];
            waypoints.push(getAeroGridPixel(tile.r, tile.c));
          }
        }
        const target = plane.homeStep + roll;
        if (target === 5) {
          finalState = 'FINISHED';
          finalHomeStep = 5;
        } else if (target > 5) {
          finalHomeStep = 5 - (target - 5);
        } else {
          finalHomeStep = target;
        }
      }

      // 执行逐步跳动动画
      animateAeroplanePath(plane, waypoints, () => {
        plane.state = finalState;
        plane.step = finalStep;
        plane.homeStep = finalHomeStep;
        delete plane.animX;
        delete plane.animY;
        delete plane.animAngle;

        // 音效与特效
        if (triggeredShortcut) {
          AUDIO.play('plane_fly');
          showToast(`🚀 ${player.name} 触发【超速飞越航线】直接穿梭棋盘！`, 2000);
          spawnAeroSparks(240, 240, AERO_COLOR_HEX[playerIdx], 30);
        } else if (triggeredJump) {
          AUDIO.play('plane_hop');
          showToast(`⚡ ${player.name} 踏中同色跑道，超速跳跃 4 格！`, 1500);
        }

        // 碰撞击落检测 (仅在公共轨道生效)
        if (plane.state === 'TRACK') {
          const myAbs = (AERO_LAUNCH_TILES[playerIdx] + plane.step) % 52;
          let knockCount = 0;
          for (let p = 0; p < 4; p++) {
            if (p === playerIdx) continue;
            const opp = STATE.aeroplane.players[p];
            opp.planes.forEach(op => {
              if (op.state === 'TRACK') {
                const oppAbs = (AERO_LAUNCH_TILES[p] + op.step) % 52;
                if (oppAbs === myAbs) {
                  op.state = 'HANGAR';
                  op.step = 0;
                  op.homeStep = -1;
                  knockCount++;
                }
              }
            });
          }
          if (knockCount > 0) {
            AUDIO.play('plane_crash');
            const tilePos = getPlanePosition(playerIdx, plane);
            spawnAeroSparks(tilePos.x, tilePos.y, '#ef4444', 35);
            showToast(`💥 ${player.name} 击落了 ${knockCount} 架敌方战机，将其遣返停机坪！`, 2500);
          }
        }

        // 到达终点大本营
        if (plane.state === 'FINISHED') {
          player.finishedCount++;
          AUDIO.play('plane_win');
          spawnAeroSparks(240, 240, AERO_COLOR_HEX[playerIdx], 40);
          showToast(`🎉 ${player.name} ${planeIdx + 1}号战机成功凯旋返港！`, 2500);

          if (player.finishedCount === 4) {
            STATE.winner = playerIdx + 1;
            AUDIO.play('win');
            STATE.aeroplane.animating = false;
            updateAeroplaneHUD();
            showModal('🏆 飞行棋冠军诞生！', `
              <div style="text-align:center; padding:10px 0;">
                <h2 style="color:${AERO_COLOR_HEX[playerIdx]}; font-size:1.4rem; margin-bottom:8px;">
                  👑 恭喜 ${player.name} 勇夺总冠军！
                </h2>
                <p style="color:#cbd5e1; font-size:0.9rem; line-height:1.6;">
                  全部 4 架战机均已安全越过风暴航线，完美抵达中央总基地！
                </p>
              </div>
            `);
            return;
          }
        }

        updateAeroplaneHUD();

        // 连掷检测 (掷出6点奖励再掷一次，最多3次防过热)
        if (roll === 6) {
          STATE.aeroplane.consecutiveSixes++;
          if (STATE.aeroplane.consecutiveSixes >= 3) {
            AUDIO.play('plane_crash');
            showToast(`⚠️ 连续 3 次掷出 6 点！发动机过热坠机，战机返航维修！`, 3000);
            plane.state = 'HANGAR';
            plane.step = 0;
            plane.homeStep = -1;
            STATE.aeroplane.consecutiveSixes = 0;
            const pos = getPlanePosition(playerIdx, plane);
            spawnAeroSparks(pos.x, pos.y, '#f59e0b', 25);
            finishAeroplaneTurn(false);
          } else {
            showToast(`🎲 掷出 6 点！获得额外连掷机会！`, 1800);
            STATE.aeroplane.animating = false;
            STATE.aeroplane.diceVal = 0;
            STATE.aeroplane.validPlanes = [];
            const promptEl = document.getElementById('aero-prompt');
            if (promptEl) promptEl.textContent = `${player.name} 获得连掷奖励！请继续掷骰子`;
            updateAeroplaneHUD();

            if (!STATE.aeroplane.humanPlayers.includes(playerIdx)) {
              const delay = STATE.aeroplane.fastAI ? 200 : 600;
              setTimeout(() => {
                runAeroplaneAI();
              }, delay);
            }
          }
        } else {
          STATE.aeroplane.consecutiveSixes = 0;
          finishAeroplaneTurn(false);
        }
      });
    }

    function animateAeroplanePath(plane, waypoints, onDone) {
      if (!waypoints || waypoints.length === 0) {
        onDone();
        return;
      }

      let stepIdx = 0;
      const isFast = STATE.aeroplane.fastAI;
      const stepDuration = isFast ? 50 : 100; // ms per hop
      let startTime = performance.now();

      function hop() {
        if (stepIdx >= waypoints.length) {
          onDone();
          return;
        }

        const target = waypoints[stepIdx];
        plane.animX = target.x;
        plane.animY = target.y;

        if (stepIdx < waypoints.length - 1) {
          const next = waypoints[stepIdx + 1];
          plane.animAngle = Math.atan2(next.y - target.y, next.x - target.x);
        }

        AUDIO.play('plane_hop');
        stepIdx++;
        setTimeout(hop, stepDuration);
      }

      hop();
    }

    function finishAeroplaneTurn(keepTurn) {
      STATE.aeroplane.animating = false;
      STATE.aeroplane.diceVal = 0;
      STATE.aeroplane.validPlanes = [];

      if (!keepTurn) {
        let next = (STATE.aeroplane.turn + 1) % 4;
        let tries = 0;
        while (STATE.aeroplane.players[next].finishedCount === 4 && tries < 4) {
          next = (next + 1) % 4;
          tries++;
        }
        STATE.aeroplane.turn = next;
        STATE.turn = next + 1;
      }

      const curPlayer = STATE.aeroplane.turn;
      const player = STATE.aeroplane.players[curPlayer];
      const isHuman = STATE.aeroplane.humanPlayers.includes(curPlayer);
      const promptEl = document.getElementById('aero-prompt');
      if (promptEl) {
        promptEl.textContent = isHuman
          ? `${player.name} 回合：请点击掷骰子`
          : `🤖 ${player.name} (电脑) 正在观察局势准备掷骰...`;
      }

      updateAeroplaneHUD();

      if (!isHuman && !STATE.winner) {
        runAeroplaneAI();
      }
    }

    function runAeroplaneAI() {
      if (STATE.winner || STATE.aeroplane.animating || STATE.aeroplane.diceRolling) return;
      const curPlayer = STATE.aeroplane.turn;
      if (STATE.aeroplane.humanPlayers.includes(curPlayer)) return;

      if (STATE.aeroplane.aiTimer) clearTimeout(STATE.aeroplane.aiTimer);
      const delay = STATE.aeroplane.fastAI ? 180 : 550;
      STATE.aeroplane.aiTimer = setTimeout(() => {
        rollAeroplaneDice(val => {
          handleDiceRollResult(val);
        });
      }, delay);
    }

    function spawnAeroSparks(x, y, color, count = 20) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4.5;
        STATE.aeroplane.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.03,
          color,
          r: 2 + Math.random() * 3
        });
      }
    }

    function getPlanePosition(playerIdx, plane) {
      if (plane.animX !== undefined && plane.animY !== undefined) {
        return { x: plane.animX, y: plane.animY, angle: plane.animAngle || 0 };
      }
      if (plane.state === 'HANGAR') {
        return { ...AERO_HANGAR_BAYS[playerIdx][plane.id], angle: 0 };
      }
      if (plane.state === 'TRACK') {
        const absTile = (AERO_LAUNCH_TILES[playerIdx] + plane.step) % 52;
        const tile = AERO_TRACK_TILES[absTile];
        const p = getAeroGridPixel(tile.r, tile.c);
        const nextTile = AERO_TRACK_TILES[(absTile + 1) % 52];
        const np = getAeroGridPixel(nextTile.r, nextTile.c);
        const angle = Math.atan2(np.y - p.y, np.x - p.x);
        return { ...p, angle };
      }
      if (plane.state === 'HOMEPATH') {
        const tile = AERO_HOME_PATHS[playerIdx][plane.homeStep];
        const p = getAeroGridPixel(tile.r, tile.c);
        const homeAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
        return { ...p, angle: homeAngles[playerIdx] };
      }
      if (plane.state === 'FINISHED') {
        const offsets = [
          { x: 240, y: 258 }, // 红
          { x: 222, y: 240 }, // 黄
          { x: 240, y: 222 }, // 蓝
          { x: 258, y: 240 }  // 绿
        ];
        return { ...offsets[playerIdx], angle: 0 };
      }
      return { x: 240, y: 240, angle: 0 };
    }

    function renderAeroplane() {
      if (STATE.currentGame !== 'AEROPLANE' || STATE.currentView !== 'GAME') return;
      STATE.aeroplane.animId = requestAnimationFrame(renderAeroplane);

      const canvas = document.getElementById('aeroplane-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // 1. 绘制棋盘大底
      drawAeroplaneBoard(ctx, 480, 480);

      // 2. 战机重叠检测与分组
      const planePositions = [];
      const curPlayer = STATE.aeroplane.turn;
      const isWaitingHuman = STATE.aeroplane.waitingForPlayerChoice && STATE.aeroplane.humanPlayers.includes(curPlayer);

      for (let p = 0; p < 4; p++) {
        const player = STATE.aeroplane.players[p];
        player.planes.forEach(pl => {
          const pos = getPlanePosition(p, pl);
          const isMovable = isWaitingHuman && (p === curPlayer) && STATE.aeroplane.validPlanes.includes(pl.id);
          planePositions.push({
            player: p,
            plane: pl,
            x: pos.x,
            y: pos.y,
            angle: pos.angle,
            color: AERO_COLOR_HEX[p],
            num: pl.id + 1,
            isMovable
          });
        });
      }

      // 计算重叠叠机计数
      const tileGroups = {};
      planePositions.forEach(item => {
        const key = `${Math.round(item.x / 10) * 10}_${Math.round(item.y / 10) * 10}`;
        if (!tileGroups[key]) tileGroups[key] = [];
        tileGroups[key].push(item);
      });

      // 3. 绘制战机
      planePositions.forEach(item => {
        const key = `${Math.round(item.x / 10) * 10}_${Math.round(item.y / 10) * 10}`;
        const grp = tileGroups[key];
        const isStacked = grp.length > 1;
        const stackCount = grp.length;
        const idxInGrp = grp.indexOf(item);
        const offsetX = isStacked ? (idxInGrp - (stackCount - 1) / 2) * 6 : 0;
        const offsetY = isStacked ? (idxInGrp - (stackCount - 1) / 2) * 6 : 0;

        drawFighterJet(
          ctx,
          item.x + offsetX,
          item.y + offsetY,
          18,
          item.angle,
          item.color,
          item.num,
          item.isMovable,
          isStacked && idxInGrp === stackCount - 1,
          stackCount
        );
      });

      // 4. 绘制粒子
      const ps = STATE.aeroplane.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawAeroplaneBoard(ctx, w, h) {
      // 科技感底色渐变
      const grad = ctx.createRadialGradient(240, 240, 60, 240, 240, 280);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0b1120');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 细微网格背景线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // 1. 绘制 4 个大停机坪底座
      const hangars = [
        { x: 6, y: 294, w: 180, h: 180, c: '#ef4444', cx: 96, cy: 384, label: '🔴 红方停机坪' },
        { x: 6, y: 6, w: 180, h: 180, c: '#f59e0b', cx: 96, cy: 96, label: '🟡 黄方停机坪' },
        { x: 294, y: 6, w: 180, h: 180, c: '#38bdf8', cx: 384, cy: 96, label: '🔵 蓝方停机坪' },
        { x: 294, y: 294, w: 180, h: 180, c: '#22c55e', cx: 384, cy: 384, label: '🟢 绿方停机坪' }
      ];

      hangars.forEach((hg, i) => {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = hg.c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(hg.x, hg.y, hg.w, hg.h, 16);
        else ctx.rect(hg.x, hg.y, hg.w, hg.h);
        ctx.fill();
        ctx.stroke();

        // 停机坪大环
        ctx.beginPath();
        ctx.arc(hg.cx, hg.cy, 66, 0, Math.PI * 2);
        ctx.fillStyle = `${hg.c}14`;
        ctx.fill();
        ctx.strokeStyle = `${hg.c}55`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 停机坪中央起飞指引大标
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = hg.c;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hg.label, hg.cx, hg.cy);

        // 4 个机位标圈
        AERO_HANGAR_BAYS[i].forEach((bay, bIdx) => {
          ctx.beginPath();
          ctx.arc(bay.x, bay.y, 16, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
          ctx.fill();
          ctx.strokeStyle = `${hg.c}88`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = '10px sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`P${bIdx + 1}`, bay.x, bay.y);
        });

        ctx.restore();
      });

      // 2. 绘制超速飞越航线 (虚线箭道直穿中心)
      const shortcuts = [
        { from: 16, to: 28, c: '#ef4444' },
        { from: 29, to: 41, c: '#f59e0b' },
        { from: 42, to: 2, c: '#38bdf8' },
        { from: 3, to: 15, c: '#22c55e' }
      ];
      shortcuts.forEach(sc => {
        const fTile = AERO_TRACK_TILES[sc.from];
        const tTile = AERO_TRACK_TILES[sc.to];
        const p1 = getAeroGridPixel(fTile.r, fTile.c);
        const p2 = getAeroGridPixel(tTile.r, tTile.c);

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = `${sc.c}88`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // 箭道中心小飞机标
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = sc.c;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', mx, my);
        ctx.restore();
      });

      // 3. 绘制 52 个外圈公用跑道格子
      ctx.save();
      // 先画连接跑道的主线
      ctx.beginPath();
      AERO_TRACK_TILES.forEach((tile, idx) => {
        const pt = getAeroGridPixel(tile.r, tile.c);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 单独绘制每个格子
      AERO_TRACK_TILES.forEach((tile, idx) => {
        const pt = getAeroGridPixel(tile.r, tile.c);
        const color = AERO_COLOR_HEX[idx % 4];
        const isLaunch = AERO_LAUNCH_TILES.includes(idx);

        ctx.save();
        ctx.fillStyle = `${color}28`;
        ctx.strokeStyle = color;
        ctx.lineWidth = isLaunch ? 2.5 : 1.2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pt.x - 13, pt.y - 13, 26, 26, 6);
        else ctx.rect(pt.x - 13, pt.y - 13, 26, 26);
        ctx.fill();
        ctx.stroke();

        if (isLaunch) {
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('起飞', pt.x, pt.y);
        } else {
          ctx.fillStyle = `${color}cc`;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();

      // 4. 绘制 4 条进入终点的直线航道
      AERO_HOME_PATHS.forEach((path, pIdx) => {
        const color = AERO_COLOR_HEX[pIdx];
        for (let i = 0; i < 5; i++) {
          const pt = getAeroGridPixel(path[i].r, path[i].c);
          ctx.save();
          ctx.fillStyle = `${color}38`;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(pt.x - 13, pt.y - 13, 26, 26, 6);
          else ctx.rect(pt.x - 13, pt.y - 13, 26, 26);
          ctx.fill();
          ctx.stroke();

          // 冲线朝向箭头
          const arrows = ['▲', '▶', '▼', '◀'];
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(arrows[pIdx], pt.x, pt.y);
          ctx.restore();
        }
      });

      // 5. 绘制中央胜利大本营 (3x3 空间四色汇聚三角)
      ctx.save();
      const cx = 240, cy = 240;
      // 红 (下三角)
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(192, 288); ctx.lineTo(288, 288); ctx.closePath();
      ctx.fillStyle = `${AERO_COLOR_HEX[0]}55`; ctx.fill();
      ctx.strokeStyle = AERO_COLOR_HEX[0]; ctx.lineWidth = 1.5; ctx.stroke();

      // 黄 (左三角)
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(192, 192); ctx.lineTo(192, 288); ctx.closePath();
      ctx.fillStyle = `${AERO_COLOR_HEX[1]}55`; ctx.fill();
      ctx.strokeStyle = AERO_COLOR_HEX[1]; ctx.lineWidth = 1.5; ctx.stroke();

      // 蓝 (上三角)
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(192, 192); ctx.lineTo(288, 192); ctx.closePath();
      ctx.fillStyle = `${AERO_COLOR_HEX[2]}55`; ctx.fill();
      ctx.strokeStyle = AERO_COLOR_HEX[2]; ctx.lineWidth = 1.5; ctx.stroke();

      // 绿 (右三角)
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(288, 192); ctx.lineTo(288, 288); ctx.closePath();
      ctx.fillStyle = `${AERO_COLOR_HEX[3]}55`; ctx.fill();
      ctx.strokeStyle = AERO_COLOR_HEX[3]; ctx.lineWidth = 1.5; ctx.stroke();

      // 中央金牌/奖杯徽章
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏆', cx, cy - 1);
      ctx.restore();
    }

    function drawFighterJet(ctx, x, y, size, angle, color, num, isMovable, isStacked, stackCount) {
      ctx.save();
      ctx.translate(x, y);

      // 可行动机动画高亮脉冲光圈
      if (isMovable) {
        const pulse = (Math.sin(Date.now() * 0.009) + 1) * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, size * 1.35 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${0.18 + pulse * 0.35})`;
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.rotate(angle);

      // 尾部喷气焰
      const flameLen = 4 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(-size * 0.8, -size * 0.2);
      ctx.lineTo(-size * 0.8 - flameLen, 0);
      ctx.lineTo(-size * 0.8, size * 0.2);
      ctx.fillStyle = '#f97316';
      ctx.fill();

      // 主机翼
      ctx.beginPath();
      ctx.moveTo(size * 0.35, 0);
      ctx.lineTo(-size * 0.35, -size * 0.9);
      ctx.lineTo(-size * 0.55, -size * 0.9);
      ctx.lineTo(-size * 0.25, 0);
      ctx.lineTo(-size * 0.55, size * 0.9);
      ctx.lineTo(-size * 0.35, size * 0.9);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 机身
      ctx.beginPath();
      ctx.moveTo(size * 0.95, 0);
      ctx.quadraticCurveTo(size * 0.25, -size * 0.35, -size * 0.7, -size * 0.3);
      ctx.lineTo(-size * 0.7, size * 0.3);
      ctx.quadraticCurveTo(size * 0.25, size * 0.35, size * 0.95, 0);
      ctx.closePath();
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 座舱盖
      ctx.beginPath();
      ctx.ellipse(size * 0.2, 0, size * 0.28, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // 独立绘制竖直正向的机号
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num, 0, 0.5);

      // 叠机角标
      if (isStacked && stackCount > 1) {
        ctx.beginPath();
        ctx.arc(10, -10, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`x${stackCount}`, 10, -9.5);
      }
      ctx.restore();
    }

    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('AEROPLANE');
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  } else {
    resetCurrentGame();
  }
});
