// ==========================================================================
// 步步为营 (QUORIDOR 4P) · 独立游戏引擎
// ==========================================================================

window.GAME_KEY = 'QUORIDOR';
window.GAME_RULES = {
  'QUORIDOR': {"title":"步步为营 (Quoridor 4P) 规则","body":"<p><strong>胜利目标：</strong>率先到达自己对向的胜利线（🔴南冲北、🟢北冲南、🔵西冲东、🟡东冲西）！</p><br>\n           <p><strong>挡板分配：</strong>双人局各 10 块；四人局各 5 块！放板必须为所有玩家至少留一条活路！</p><br>\n           <p><strong>跳跃规则：</strong>面对邻格棋子可直线跳过；若正向受阻或有墙，可向侧方斜跳！</p><br>\n           <p><strong>轮替顺序：</strong>顺时针依次行动（🔴P1 -> 🔵P3 -> 🟢P2 -> 🟡P4）！</p>"}
};

const STATE = {
  currentGame: 'QUORIDOR',
  gameMode: 'AI',
  turn: 1,
  winner: null,
  animating: false,
  online: {
    roomId: null,
    myRole: null,
    connected: false,
    mqttClient: null,
    opponentJoined: false
  },
  quoridor: {
    playerCount: 2,
    p1: { r: 8, c: 4, walls: 10 },
    p2: { r: 0, c: 4, walls: 10 },
    p3: { r: 4, c: 0, walls: 5 },
    p4: { r: 4, c: 8, walls: 5 },
    wallsH: new Set(),
    wallsV: new Set(),
    tool: 'MOVE',
    hoverPos: null,
    lastMove: null
  }
};
window.STATE = STATE;

function switchGameMode(mode, doReset = true) {
  if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('click');
  STATE.gameMode = mode;
  document.getElementById('tab-online').classList.toggle('active', mode === 'ONLINE');
  document.getElementById('tab-ai').classList.toggle('active', mode === 'AI');
  document.getElementById('tab-local').classList.toggle('active', mode === 'LOCAL');
  document.getElementById('online-panel').classList.toggle('hidden', mode !== 'ONLINE');

  if (doReset) {
    resetCurrentGame();
  }
}

function setQuoridorPlayerCount(count) {
  if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('click');
  STATE.quoridor.playerCount = count;
  document.getElementById('btn-q-2p').classList.toggle('active', count === 2);
  document.getElementById('btn-q-4p').classList.toggle('active', count === 4);
  resetCurrentGame();
}

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

function endTurn() {
  if (STATE.quoridor.playerCount === 4) {
    const order = { 1: 3, 3: 2, 2: 4, 4: 1 };
    STATE.turn = order[STATE.turn] || 1;
  } else {
    STATE.turn = STATE.turn === 1 ? 2 : 1;
  }
  updateScoreboard();

  if (!STATE.winner && STATE.gameMode === 'AI' && STATE.turn !== 1) {
    STATE.animating = true;
    const botNames = { 2: '🟢 绿方电脑', 3: '🔵 蓝方电脑', 4: '🟡 黄方电脑' };
    const bName = botNames[STATE.turn] || '🤖 电脑 AI';
    const status = document.getElementById('status-text');
    if (status) status.textContent = `${bName} 正在深思熟虑...`;
    setTimeout(() => {
      runQuoridorAI();
    }, 500);
  }
}

function resetCurrentGame() {
  STATE.winner = null;
  STATE.turn = 1;
  STATE.animating = false;
  const is4P = STATE.quoridor.playerCount === 4;
  const initialWalls = is4P ? 5 : 10;
  STATE.quoridor.p1 = { r: 8, c: 4, walls: initialWalls };
  STATE.quoridor.p2 = { r: 0, c: 4, walls: initialWalls };
  STATE.quoridor.p3 = { r: 4, c: 0, walls: initialWalls };
  STATE.quoridor.p4 = { r: 4, c: 8, walls: initialWalls };
  STATE.quoridor.wallsH.clear();
  STATE.quoridor.wallsV.clear();
  STATE.quoridor.hoverPos = null;
  STATE.quoridor.lastMove = null;
  setQuoridorTool('MOVE');
  updateScoreboard();
  resizeCanvas2D();
  render2D();
}

function updateScoreboard() {
  const is4P = STATE.quoridor.playerCount === 4;
  const genericScoreboard = document.getElementById('generic-scoreboard');

  const elP1 = document.getElementById('walls-count-p1');
  const elP2 = document.getElementById('walls-count-p2');
  if (elP1) elP1.textContent = STATE.quoridor.p1.walls;
  if (elP2) elP2.textContent = STATE.quoridor.p2.walls;
  if (is4P) {
    const elP3 = document.getElementById('walls-count-p3');
    const elP4 = document.getElementById('walls-count-p4');
    if (elP3) elP3.textContent = STATE.quoridor.p3.walls;
    if (elP4) elP4.textContent = STATE.quoridor.p4.walls;
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

  if (card1) card1.classList.toggle('active', STATE.turn === 1);
  if (card2) card2.classList.toggle('active', STATE.turn === 2);
  if (card3) card3.classList.toggle('active', STATE.turn === 3);
  if (card4) card4.classList.toggle('active', STATE.turn === 4);

  if (is4P) {
    if (genericScoreboard) genericScoreboard.classList.add('scoreboard-4p');
    if (card3) card3.style.display = 'flex';
    if (card4) card4.style.display = 'flex';
    const wp3 = document.getElementById('walls-wrapper-p3');
    const wp4 = document.getElementById('walls-wrapper-p4');
    if (wp3) wp3.style.display = 'block';
    if (wp4) wp4.style.display = 'block';
    const nameP1 = document.getElementById('name-p1');
    const nameP2 = document.getElementById('name-p2');
    const nameP3 = document.getElementById('name-p3');
    const nameP4 = document.getElementById('name-p4');
    if (nameP1) nameP1.textContent = '🔴 南门 (先手)';
    if (nameP3) nameP3.textContent = STATE.gameMode === 'AI' ? '🔵 西门 (电脑)' : '🔵 西门 (玩家3)';
    if (nameP2) nameP2.textContent = STATE.gameMode === 'AI' ? '🟢 北门 (电脑)' : '🟢 北门 (玩家2)';
    if (nameP4) nameP4.textContent = STATE.gameMode === 'AI' ? '🟡 东门 (电脑)' : '🟡 东门 (玩家4)';
  } else {
    if (genericScoreboard) genericScoreboard.classList.remove('scoreboard-4p');
    if (card3) card3.style.display = 'none';
    if (card4) card4.style.display = 'none';
    const nameP1 = document.getElementById('name-p1');
    const nameP2 = document.getElementById('name-p2');
    if (nameP1) nameP1.textContent = '🔴 红方 (先手)';
    if (nameP2) nameP2.textContent = STATE.gameMode === 'AI' ? '🟢 绿方 (电脑)' : (STATE.gameMode === 'ONLINE' ? '🟢 绿方 (客方)' : '🟢 绿方 (后手)');
  }

  const status = document.getElementById('status-text');
  if (status) {
    if (STATE.winner) {
      const winnerNames = {
        1: '🏆 🔴 红方胜利！',
        2: '🏆 🟢 绿方胜利！',
        3: '🏆 🔵 蓝方胜利！',
        4: '🏆 🟡 黄方胜利！'
      };
      status.textContent = winnerNames[STATE.winner] || '🏆 对局结束！';
    } else {
      if (STATE.gameMode === 'ONLINE') {
        status.textContent = !STATE.online.opponentJoined ? '⏳ 等待好友加入房间...' : (checkIsMyTurn() ? '👉 轮到你的回合！' : '⏳ 对手思考中...');
      } else if (STATE.gameMode === 'AI') {
        const names = { 1: '👉 轮到你行动', 2: '🤖 🟢 绿方电脑思考中...', 3: '🤖 🔵 蓝方电脑思考中...', 4: '🤖 🟡 黄方电脑思考中...' };
        status.textContent = names[STATE.turn] || '🤖 电脑思考中...';
      } else {
        const names = { 1: '👉 轮到 🔴 红方行动', 2: '👉 轮到 🟢 绿方行动', 3: '👉 轮到 🔵 蓝方行动', 4: '👉 轮到 🟡 黄方行动' };
        status.textContent = names[STATE.turn] || '请行动';
      }
    }
  }
}

// Online action handler
window.handleGameOnlineAction = function(msg) {
  if (msg.type === 'QUORIDOR_MOVE') {
    executeQuoridorMove(msg.r, msg.c);
  } else if (msg.type === 'QUORIDOR_WALL') {
    executeQuoridorWall(msg.wallType, msg.r, msg.c);
  }
};

// Canvas and 2D Engine
// 2. 步步为营逻辑 (QUORIDOR)
    // ==========================================================================
    const canvas2D = document.getElementById('board-canvas');
    const ctx2D = canvas2D.getContext('2d');
    let cellSize = 0, grooveSize = 0, offset = 0;

    function isBlockedByWall(r1, c1, r2, c2, wallsH, wallsV) {
      if (r1 === r2) {
        const minC = Math.min(c1, c2);
        if (wallsV.has(`${r1},${minC}`) || wallsV.has(`${r1 - 1},${minC}`)) return true;
      } else if (c1 === c2) {
        const minR = Math.min(r1, r2);
        if (wallsH.has(`${minR},${c1}`) || wallsH.has(`${minR},${c1 - 1}`)) return true;
      }
      return false;
    }

    function getValidPawnMoves(player) {
      const is4P = STATE.quoridor.playerCount === 4;
      const players = {
        1: STATE.quoridor.p1,
        2: STATE.quoridor.p2,
        3: STATE.quoridor.p3,
        4: STATE.quoridor.p4
      };
      const cur = players[player];
      const allActive = is4P ? [STATE.quoridor.p1, STATE.quoridor.p2, STATE.quoridor.p3, STATE.quoridor.p4] : [STATE.quoridor.p1, STATE.quoridor.p2];
      const others = allActive.filter(p => p !== cur);

      const wallsH = STATE.quoridor.wallsH;
      const wallsV = STATE.quoridor.wallsV;
      const moves = [];
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

      for (const d of dirs) {
        const nr = cur.r + d.dr;
        const nc = cur.c + d.dc;
        if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
        if (isBlockedByWall(cur.r, cur.c, nr, nc, wallsH, wallsV)) continue;

        const opp = others.find(p => p.r === nr && p.c === nc);
        if (opp) {
          // 直线跳跃
          const jumpR = nr + d.dr;
          const jumpC = nc + d.dc;
          const jumpOccupied = others.some(p => p.r === jumpR && p.c === jumpC);
          const canStraight = jumpR >= 0 && jumpR < 9 && jumpC >= 0 && jumpC < 9 &&
                              !jumpOccupied &&
                              !isBlockedByWall(opp.r, opp.c, jumpR, jumpC, wallsH, wallsV);

          if (canStraight) {
            moves.push({ r: jumpR, c: jumpC });
          } else {
            // 斜向跳跃 (当正向被阻挡、出界或有第三方子)
            const sideDirs = d.dr !== 0 ? [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }] : [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }];
            for (const sd of sideDirs) {
              const diagR = opp.r + sd.dr;
              const diagC = opp.c + sd.dc;
              if (diagR >= 0 && diagR < 9 && diagC >= 0 && diagC < 9) {
                const diagOccupied = others.some(p => p.r === diagR && p.c === diagC);
                if (!diagOccupied && !isBlockedByWall(opp.r, opp.c, diagR, diagC, wallsH, wallsV)) {
                  moves.push({ r: diagR, c: diagC });
                }
              }
            }
          }
        } else {
          moves.push({ r: nr, c: nc });
        }
      }
      return moves;
    }

    function hasPath(startR, startC, targetType, targetVal, wallsH, wallsV) {
      const queue = [{ r: startR, c: startC }];
      const visited = new Uint8Array(81);
      visited[startR * 9 + startC] = 1;
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

      while (queue.length > 0) {
        const { r, c } = queue.shift();
        if (targetType === 'ROW' && r === targetVal) return true;
        if (targetType === 'COL' && c === targetVal) return true;

        for (const d of dirs) {
          const nr = r + d.dr, nc = c + d.dc;
          if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
          if (visited[nr * 9 + nc]) continue;
          if (isBlockedByWall(r, c, nr, nc, wallsH, wallsV)) continue;
          visited[nr * 9 + nc] = 1;
          queue.push({ r: nr, c: nc });
        }
      }
      return false;
    }

    function getShortestDistance(startR, startC, targetType, targetVal, wallsH, wallsV) {
      const queue = [{ r: startR, c: startC, dist: 0 }];
      const visited = new Uint8Array(81);
      visited[startR * 9 + startC] = 1;
      const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

      while (queue.length > 0) {
        const { r, c, dist } = queue.shift();
        if (targetType === 'ROW' && r === targetVal) return dist;
        if (targetType === 'COL' && c === targetVal) return dist;

        for (const d of dirs) {
          const nr = r + d.dr, nc = c + d.dc;
          if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
          if (visited[nr * 9 + nc]) continue;
          if (isBlockedByWall(r, c, nr, nc, wallsH, wallsV)) continue;
          visited[nr * 9 + nc] = 1;
          queue.push({ r: nr, c: nc, dist: dist + 1 });
        }
      }
      return Infinity;
    }

    function canPlaceWall(type, r, c) {
      if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;
      const wallsH = STATE.quoridor.wallsH;
      const wallsV = STATE.quoridor.wallsV;
      if (type === 'H' && wallsV.has(`${r},${c}`)) return false;
      if (type === 'V' && wallsH.has(`${r},${c}`)) return false;

      if (type === 'H') {
        if (wallsH.has(`${r},${c}`) || wallsH.has(`${r},${c - 1}`) || wallsH.has(`${r},${c + 1}`)) return false;
      } else {
        if (wallsV.has(`${r},${c}`) || wallsV.has(`${r - 1},${c}`) || wallsV.has(`${r + 1},${c}`)) return false;
      }

      const testH = new Set(wallsH);
      const testV = new Set(wallsV);
      if (type === 'H') testH.add(`${r},${c}`);
      else testV.add(`${r},${c}`);

      // 必须确保所有在场玩家均有活路
      const p1 = STATE.quoridor.p1;
      const p2 = STATE.quoridor.p2;
      if (!hasPath(p1.r, p1.c, 'ROW', 0, testH, testV)) return false;
      if (!hasPath(p2.r, p2.c, 'ROW', 8, testH, testV)) return false;

      if (STATE.quoridor.playerCount === 4) {
        const p3 = STATE.quoridor.p3;
        const p4 = STATE.quoridor.p4;
        if (!hasPath(p3.r, p3.c, 'COL', 8, testH, testV)) return false;
        if (!hasPath(p4.r, p4.c, 'COL', 0, testH, testV)) return false;
      }
      return true;
    }

    function setQuoridorTool(tool) {
      AUDIO.play('click');
      STATE.quoridor.tool = tool;
      document.getElementById('tool-move').classList.toggle('active', tool === 'MOVE');
      document.getElementById('tool-wall-h').classList.toggle('active', tool === 'WALL_H');
      document.getElementById('tool-wall-v').classList.toggle('active', tool === 'WALL_V');
      STATE.quoridor.hoverPos = null;
      render2D();
    }

    function executeQuoridorMove(r, c) {
      AUDIO.play('drop');
      const players = {
        1: STATE.quoridor.p1,
        2: STATE.quoridor.p2,
        3: STATE.quoridor.p3,
        4: STATE.quoridor.p4
      };
      const cur = players[STATE.turn];
      const fromR = cur.r, fromC = cur.c;
      cur.r = r; cur.c = c;
      STATE.quoridor.lastMove = { type: 'MOVE', player: STATE.turn, fromR, fromC, r, c };

      let winner = null;
      if (STATE.quoridor.p1.r === 0) winner = 1;
      else if (STATE.quoridor.p2.r === 8) winner = 2;
      else if (STATE.quoridor.playerCount === 4 && STATE.quoridor.p3.c === 8) winner = 3;
      else if (STATE.quoridor.playerCount === 4 && STATE.quoridor.p4.c === 0) winner = 4;

      if (winner !== null) {
        AUDIO.play('win');
        STATE.winner = winner;
        const names = {
          1: '🔴 红方 (南门)',
          2: '🟢 绿方 (北门)',
          3: '🔵 蓝方 (西门)',
          4: '🟡 黄方 (东门)'
        };
        showModal('🎉 游戏结束', `<strong>${names[winner]} 成功抵达终点线，斩获胜利！</strong>`);
      } else {
        endTurn();
      }
      render2D();
    }

    function executeQuoridorWall(type, r, c) {
      AUDIO.play('drop');
      if (type === 'H') STATE.quoridor.wallsH.add(`${r},${c}`);
      else STATE.quoridor.wallsV.add(`${r},${c}`);
      const players = {
        1: STATE.quoridor.p1,
        2: STATE.quoridor.p2,
        3: STATE.quoridor.p3,
        4: STATE.quoridor.p4
      };
      const cur = players[STATE.turn];
      cur.walls--;
      STATE.quoridor.lastMove = { type: 'WALL', player: STATE.turn, wallType: type, r, c };
      STATE.quoridor.hoverPos = null;
      endTurn();
      render2D();
    }

    function runQuoridorAI() {
      if (STATE.winner) return;
      const goals = {
        2: { type: 'ROW', val: 8 },
        3: { type: 'COL', val: 8 },
        4: { type: 'COL', val: 0 }
      };
      const goal = goals[STATE.turn] || { type: 'ROW', val: 8 };
      const moves = getValidPawnMoves(STATE.turn);

      if (moves.length > 0) {
        moves.sort((a, b) => {
          const da = getShortestDistance(a.r, a.c, goal.type, goal.val, STATE.quoridor.wallsH, STATE.quoridor.wallsV);
          const db = getShortestDistance(b.r, b.c, goal.type, goal.val, STATE.quoridor.wallsH, STATE.quoridor.wallsV);
          return da - db;
        });
        executeQuoridorMove(moves[0].r, moves[0].c);
      }
      STATE.animating = false;
      render2D();
    }

    

// --- 2D 画布基础与绘制 ---
    function resizeCanvas2D() {
      const rect = canvas2D.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas2D.width = rect.width * dpr;
      canvas2D.height = rect.height * dpr;
      ctx2D.resetTransform();
      ctx2D.scale(dpr, dpr);

      // GRAVITY4 用 7列 4行比例; 其余(QUORIDOR/GRAVITY) 用 9x9
      const cols = STATE.currentGame === 'GRAVITY4' ? 7 : 9;
      grooveSize = rect.width / (cols * 4.5 + (cols - 1));
      cellSize = grooveSize * 4.5;
      offset = grooveSize / 2;
      render2D();
    }

    function getCellPos(r, c) {
      return { x: offset + c * (cellSize + grooveSize), y: offset + r * (cellSize + grooveSize) };
    }
    function getIntersectionPos(r, c) {
      return { x: offset + (c + 1) * cellSize + c * grooveSize, y: offset + (r + 1) * cellSize + r * grooveSize };
    }

    function render2D() {
      const isG = ['QUORIDOR', 'GRAVITY', 'GRAVITY4'].includes(STATE.currentGame);
      if (STATE.currentView !== 'GAME' || !isG) return;
      const w = canvas2D.getBoundingClientRect().width;
      const h = canvas2D.getBoundingClientRect().height;
      ctx2D.clearRect(0, 0, w, h);

      if (STATE.currentGame === 'QUORIDOR') renderQuoridor();
      else if (STATE.currentGame === 'GRAVITY4') renderGravity4();
      else renderGravity2D();
    }

    function renderQuoridor() {
      const is4P = STATE.quoridor.playerCount === 4;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const { x, y } = getCellPos(r, c);
          let bg = '#263346';
          if (r === 0) bg = 'rgba(255, 71, 87, 0.15)';
          else if (r === 8) bg = 'rgba(46, 213, 115, 0.15)';
          else if (is4P && c === 8) bg = 'rgba(56, 189, 248, 0.15)';
          else if (is4P && c === 0) bg = 'rgba(234, 179, 8, 0.15)';

          ctx2D.fillStyle = bg;
          ctx2D.beginPath();
          ctx2D.roundRect(x, y, cellSize, cellSize, 6);
          ctx2D.fill();
        }
      }

      const isMyTurn = checkIsMyTurn();
      if (!STATE.winner && STATE.quoridor.tool === 'MOVE' && isMyTurn) {
        const moves = getValidPawnMoves(STATE.turn);
        const colors = {
          1: 'rgba(255, 71, 87, 0.55)',
          2: 'rgba(46, 213, 115, 0.55)',
          3: 'rgba(56, 189, 248, 0.55)',
          4: 'rgba(234, 179, 8, 0.55)'
        };
        const moveColor = colors[STATE.turn] || colors[1];
        for (const m of moves) {
          const { x, y } = getCellPos(m.r, m.c);
          ctx2D.beginPath();
          ctx2D.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.18, 0, Math.PI * 2);
          ctx2D.fillStyle = moveColor;
          ctx2D.fill();
          ctx2D.strokeStyle = '#fff';
          ctx2D.lineWidth = 1.5;
          ctx2D.stroke();
        }
      }

      const wallHWidth = cellSize * 2 + grooveSize;
      const wallThickness = grooveSize;

      for (const key of STATE.quoridor.wallsH) {
        const [r, c] = key.split(',').map(Number);
        const { x, y } = getIntersectionPos(r, c);
        ctx2D.fillStyle = '#eccc68';
        ctx2D.beginPath();
        ctx2D.roundRect(x - cellSize, y, wallHWidth, wallThickness, 3);
        ctx2D.fill();
      }
      for (const key of STATE.quoridor.wallsV) {
        const [r, c] = key.split(',').map(Number);
        const { x, y } = getIntersectionPos(r, c);
        ctx2D.fillStyle = '#eccc68';
        ctx2D.beginPath();
        ctx2D.roundRect(x, y - cellSize, wallThickness, wallHWidth, 3);
        ctx2D.fill();
      }

      if (STATE.quoridor.hoverPos && !STATE.winner && isMyTurn) {
        const hp = STATE.quoridor.hoverPos;
        const { x, y } = getIntersectionPos(hp.r, hp.c);
        ctx2D.fillStyle = hp.valid ? 'rgba(46, 213, 115, 0.7)' : 'rgba(255, 71, 87, 0.7)';
        if (hp.type === 'wallH') {
          ctx2D.beginPath(); ctx2D.roundRect(x - cellSize, y, wallHWidth, wallThickness, 3); ctx2D.fill();
        } else {
          ctx2D.beginPath(); ctx2D.roundRect(x, y - cellSize, wallThickness, wallHWidth, 3); ctx2D.fill();
        }
      }

      drawSphere2D(STATE.quoridor.p1.r, STATE.quoridor.p1.c, 1);
      drawSphere2D(STATE.quoridor.p2.r, STATE.quoridor.p2.c, 2);
      if (is4P) {
        drawSphere2D(STATE.quoridor.p3.r, STATE.quoridor.p3.c, 3);
        drawSphere2D(STATE.quoridor.p4.r, STATE.quoridor.p4.c, 4);
      }
    }

    
function render2D() {
  renderQuoridor();
}

function drawSphere2D(r, c, player) {
      const { x, y } = getCellPos(r, c);
      const cx = x + cellSize / 2, cy = y + cellSize / 2, radius = cellSize * 0.38;
      const grad = ctx2D.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      if (player === 1) {
        grad.addColorStop(0, '#ff9fa8'); grad.addColorStop(0.3, '#ff4757'); grad.addColorStop(1, '#8b0015');
      } else if (player === 2) {
        grad.addColorStop(0, '#a8ffca'); grad.addColorStop(0.3, '#2ed573'); grad.addColorStop(1, '#0e6231');
      } else if (player === 3) {
        grad.addColorStop(0, '#bae6fd'); grad.addColorStop(0.3, '#38bdf8'); grad.addColorStop(1, '#0369a1');
      } else if (player === 4) {
        grad.addColorStop(0, '#fef08a'); grad.addColorStop(0.3, '#eab308'); grad.addColorStop(1, '#854d0e');
      }
      ctx2D.beginPath(); ctx2D.arc(cx, cy, radius, 0, Math.PI * 2); ctx2D.fillStyle = grad; ctx2D.fill();
      ctx2D.beginPath(); ctx2D.arc(cx - radius * 0.25, cy - radius * 0.3, radius * 0.18, 0, Math.PI * 2);
      ctx2D.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx2D.fill();
    }



function getPointerCoord2D(e) {
  const rect = canvas2D.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { px: clientX - rect.left, py: clientY - rect.top };
}

canvas2D.addEventListener('pointermove', (e) => {
  if (STATE.winner || STATE.animating) return;
  const { px, py } = getPointerCoord2D(e);
  if (!checkIsMyTurn()) return;
  if (STATE.quoridor.tool === 'MOVE') {
    STATE.quoridor.hoverPos = null;
  } else {
    let best = null, minDist = Infinity;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const { x, y } = getIntersectionPos(r, c);
        const dist = Math.hypot(px - (x + grooveSize / 2), py - (y + grooveSize / 2));
        if (dist < minDist) { minDist = dist; best = { r, c }; }
      }
    }
    if (best && minDist < cellSize * 1.2) {
      const type = STATE.quoridor.tool === 'WALL_H' ? 'wallH' : 'wallV';
      const valid = canPlaceWall(STATE.quoridor.tool === 'WALL_H' ? 'H' : 'V', best.r, best.c);
      STATE.quoridor.hoverPos = { type, r: best.r, c: best.c, valid };
    } else {
      STATE.quoridor.hoverPos = null;
    }
  }
  render2D();
});

canvas2D.addEventListener('pointerleave', () => {
  STATE.quoridor.hoverPos = null;
  render2D();
});

canvas2D.addEventListener('click', (e) => {
  if (STATE.winner || STATE.animating) return;
  const { px, py } = getPointerCoord2D(e);

  if (!checkIsMyTurn()) {
    if (STATE.gameMode === 'ONLINE' && !STATE.online.opponentJoined) {
      showToast('💡 当前为好友联机模式：请点击【➕ 创建新房间】并将链接发给好友，或切换为【🤖 人机对战】！', 4000);
    } else {
      showToast('⏳ 对手思考中...');
    }
    return;
  }

  if (STATE.quoridor.tool === 'MOVE') {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const { x, y } = getCellPos(r, c);
        if (px >= x && px <= x + cellSize && py >= y && py <= y + cellSize) {
          const moves = getValidPawnMoves(STATE.turn);
          if (moves.some(m => m.r === r && m.c === c)) {
            executeQuoridorMove(r, c);
            if (STATE.gameMode === 'ONLINE') sendOnlineAction({ type: 'QUORIDOR_MOVE', r, c });
          }
          return;
        }
      }
    }
  } else if (STATE.quoridor.hoverPos && STATE.quoridor.hoverPos.valid) {
    const hp = STATE.quoridor.hoverPos;
    const players = {
      1: STATE.quoridor.p1,
      2: STATE.quoridor.p2,
      3: STATE.quoridor.p3,
      4: STATE.quoridor.p4
    };
    const cur = players[STATE.turn];
    if (cur && cur.walls > 0) {
      const wallType = STATE.quoridor.tool === 'WALL_H' ? 'H' : 'V';
      executeQuoridorWall(wallType, hp.r, hp.c);
      if (STATE.gameMode === 'ONLINE') sendOnlineAction({ type: 'QUORIDOR_WALL', wallType, r: hp.r, c: hp.c });
    }
  }
});

window.addEventListener('resize', () => {
  resizeCanvas2D();
  render2D();
});

window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('QUORIDOR');
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  } else {
    resetCurrentGame();
  }
});
