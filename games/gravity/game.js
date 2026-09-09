// ==========================================================================
// 重力五子棋 (GRAVITY 2D) · 独立游戏引擎
// ==========================================================================

window.GAME_KEY = 'GRAVITY';
window.GAME_RULES = {
  'GRAVITY': {"title":"重力五子棋 (2D) 规则","body":"<p><strong>重力下落：</strong>点击任意一列，棋子受重力自然滑落堆叠到底部。</p><br>\n           <p><strong>胜利目标：</strong>在横向、纵向或对角线连成 <b>5 颗连续同色棋子</b> 者获胜！</p><br>\n           <p><strong>核心博弈：</strong>棋子无法悬空停留，小心别给对手送出\"垫脚石\"！</p>"}
};

const STATE = {
  currentGame: 'GRAVITY',
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
  gravity: {
    board: Array.from({ length: 9 }, () => new Array(9).fill(0)),
    hoverCol: null,
    winningLine: null,
    animatingPiece: null,
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
  STATE.turn = STATE.turn === 1 ? 2 : 1;
  updateScoreboard();

  if (!STATE.winner && STATE.gameMode === 'AI' && STATE.turn !== 1) {
    STATE.animating = true;
    const status = document.getElementById('status-text');
    if (status) status.textContent = '🤖 黄方电脑 正在深思熟虑...';
    setTimeout(() => {
      runGravity2DAI();
    }, 500);
  }
}

function resetCurrentGame() {
  STATE.winner = null;
  STATE.turn = 1;
  STATE.animating = false;
  STATE.gravity.board = Array.from({ length: 9 }, () => new Array(9).fill(0));
  STATE.gravity.hoverCol = null;
  STATE.gravity.winningLine = null;
  STATE.gravity.animatingPiece = null;
  STATE.gravity.lastMove = null;
  updateScoreboard();
  resizeCanvas2D();
  render2D();
}

function updateScoreboard() {
  const genericScoreboard = document.getElementById('generic-scoreboard');
  if (genericScoreboard) genericScoreboard.classList.remove('scoreboard-4p');

  const card3 = document.getElementById('card-p3');
  const card4 = document.getElementById('card-p4');
  if (card3) card3.style.display = 'none';
  if (card4) card4.style.display = 'none';

  const card1 = document.getElementById('card-p1');
  const card2 = document.getElementById('card-p2');
  if (card1) card1.classList.toggle('active', STATE.turn === 1);
  if (card2) card2.classList.toggle('active', STATE.turn === 2);

  const nameP1 = document.getElementById('name-p1');
  const nameP2 = document.getElementById('name-p2');
  if (nameP1) nameP1.textContent = '🔴 红方 (先手)';
  if (nameP2) nameP2.textContent = STATE.gameMode === 'AI' ? '🟡 黄方 (电脑)' : (STATE.gameMode === 'ONLINE' ? '🟡 黄方 (客方)' : '🟡 黄方 (后手)');

  const status = document.getElementById('status-text');
  if (status) {
    if (STATE.winner) {
      status.textContent = STATE.winner === 1 ? '🏆 🔴 红方胜利！' : '🏆 🟡 黄方胜利！';
    } else {
      if (STATE.gameMode === 'ONLINE') {
        status.textContent = !STATE.online.opponentJoined ? '⏳ 等待好友加入房间...' : (checkIsMyTurn() ? '👉 轮到你的回合！' : '⏳ 对手思考中...');
      } else if (STATE.gameMode === 'AI') {
        status.textContent = STATE.turn === 1 ? '👉 轮到你行动' : '🤖 🟡 黄方电脑思考中...';
      } else {
        status.textContent = STATE.turn === 1 ? '👉 轮到 🔴 红方行动' : '👉 轮到 🟡 黄方行动';
      }
    }
  }
}

// Online action handler
window.handleGameOnlineAction = function(msg) {
  if (msg.type === 'GRAVITY_DROP') {
    const tr = getGravityLandingRow(msg.col);
    if (tr !== -1) executeGravityDrop(msg.col, tr, STATE.turn, false);
  }
};

const canvas2D = document.getElementById('board-canvas');
const ctx2D = canvas2D.getContext('2d');

// 3. 2D 重力五子棋逻辑 (GRAVITY 2D)
    // ==========================================================================
    function getGravityLandingRow(col) {
      const board = STATE.gravity.board;
      for (let r = 8; r >= 0; r--) {
        if (board[r][col] === 0) return r;
      }
      return -1;
    }

    function checkGravityWin(r, c, player) {
      const board = STATE.gravity.board;
      const dirs = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
      for (const d of dirs) {
        let line = [{ r, c }];
        let step = 1;
        while (true) {
          const nr = r + d.dr * step, nc = c + d.dc * step;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && board[nr][nc] === player) { line.push({ r: nr, c: nc }); step++; }
          else break;
        }
        step = 1;
        while (true) {
          const nr = r - d.dr * step, nc = c - d.dc * step;
          if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && board[nr][nc] === player) { line.push({ r: nr, c: nc }); step++; }
          else break;
        }
        if (line.length >= 5) return line;
      }
      return null;
    }

    function dropGravityCol(col) {
      if (STATE.winner || STATE.animating) return;
      if (!checkIsMyTurn()) {
        if (STATE.gameMode === 'ONLINE') {
          if (!STATE.online.opponentJoined) {
            showToast('💡 当前为好友联机模式：请点击【➕ 创建新房间】并将链接发给好友，或切换为【🤖 人机对战】！', 4000);
          } else {
            showToast('⏳ 正在等待对方下子...');
          }
        } else if (STATE.gameMode === 'AI') {
          showToast('🤖 电脑 AI 正在思考，请稍候...');
        }
        return;
      }
      const targetRow = getGravityLandingRow(col);
      if (targetRow === -1) { showToast('⚠️ 该列已满！'); return; }
      executeGravityDrop(col, targetRow, STATE.turn, true);
    }

    function executeGravityDrop(col, targetRow, player, isLocalAction = false) {
      STATE.animating = true;
      const startY = offset - cellSize;
      const targetPos = getCellPos(targetRow, col);
      const targetY = targetPos.y;

      let curY = startY;
      let vy = 4;
      const gravityAcc = 1.8;

      function animStep() {
        vy += gravityAcc;
        curY += vy;
        if (curY >= targetY) {
          AUDIO.play('drop');
          curY = targetY;
          STATE.gravity.board[targetRow][col] = player;
          STATE.gravity.lastMove = { r: targetRow, c: col, player };
          STATE.gravity.animatingPiece = null;
          STATE.animating = false;

          const winLine = checkGravityWin(targetRow, col, player);
          if (winLine) {
            AUDIO.play('win');
            STATE.winner = player;
            STATE.gravity.winningLine = winLine;
            const pName = player === 1 ? '🔴 红棋' : '🟡 黄棋';
            showModal('🎉 恭喜获胜！', `${pName} 成功连成 5 颗同色棋子，赢得对局！`);
          } else {
            let full = true;
            for (let c = 0; c < 9; c++) {
              if (STATE.gravity.board[0][c] === 0) { full = false; break; }
            }
            if (full) {
              STATE.winner = 3;
              showModal('🤝 势均力敌', '棋盘已全满，双方达成平局！');
            } else {
              endTurn();
            }
          }

          if (isLocalAction && STATE.gameMode === 'ONLINE') {
            sendOnlineAction({ type: 'GRAVITY_DROP', col });
          }
          render2D();
        } else {
          STATE.gravity.animatingPiece = { col, curY, player };
          render2D();
          requestAnimationFrame(animStep);
        }
      }
      requestAnimationFrame(animStep);
    }

    function runGravity2DAI() {
      if (STATE.winner) return;
      const board = STATE.gravity.board;
      let bestCol = -1, maxScore = -Infinity;

      for (let c = 0; c < 9; c++) {
        const r = getGravityLandingRow(c);
        if (r === -1) continue;

        let score = 0;
        board[r][c] = 2;
        if (checkGravityWin(r, c, 2)) { board[r][c] = 0; executeGravityDrop(c, r, 2); return; }
        board[r][c] = 0;

        board[r][c] = 1;
        if (checkGravityWin(r, c, 1)) score += 10000;
        board[r][c] = 0;

        if (r > 0) {
          board[r - 1][c] = 1;
          if (checkGravityWin(r - 1, c, 1)) score -= 8000;
          board[r - 1][c] = 0;
        }

        score += (4 - Math.abs(c - 4)) * 10 + r * 5;
        if (score > maxScore) { maxScore = score; bestCol = c; }
      }

      if (bestCol !== -1) {
        const tr = getGravityLandingRow(bestCol);
        executeGravityDrop(bestCol, tr, 2);
      }
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
  renderGravity2D();
}

function renderGravity2D() {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const { x, y } = getCellPos(r, c);
          const cx = x + cellSize / 2, cy = y + cellSize / 2, radius = cellSize * 0.42;

          ctx2D.fillStyle = '#172033';
          ctx2D.beginPath(); ctx2D.roundRect(x, y, cellSize, cellSize, 8); ctx2D.fill();
          ctx2D.beginPath(); ctx2D.arc(cx, cy, radius, 0, Math.PI * 2); ctx2D.fillStyle = '#0f172a'; ctx2D.fill();

          const piece = STATE.gravity.board[r][c];
          if (piece !== 0) {
            drawGravityPiece2D(cx, cy, radius, piece);
            if (STATE.gravity.lastMove && STATE.gravity.lastMove.r === r && STATE.gravity.lastMove.c === c) {
              drawLastMoveMarker2D(cx, cy, radius);
            }
          }
        }
      }

      if (STATE.gravity.animatingPiece) {
        const ap = STATE.gravity.animatingPiece;
        const targetPos = getCellPos(0, ap.col);
        drawGravityPiece2D(targetPos.x + cellSize / 2, ap.curY + cellSize / 2, cellSize * 0.42, ap.player);
      }

      if (STATE.gravity.hoverCol !== null && !STATE.winner && checkIsMyTurn() && !STATE.animating) {
        const tr = getGravityLandingRow(STATE.gravity.hoverCol);
        if (tr !== -1) {
          const pos = getCellPos(tr, STATE.gravity.hoverCol);
          ctx2D.beginPath();
          ctx2D.arc(pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
          ctx2D.fillStyle = STATE.turn === 1 ? 'rgba(255, 71, 87, 0.25)' : 'rgba(241, 196, 15, 0.25)';
          ctx2D.fill();
        }
      }

      if (STATE.gravity.winningLine) {
        for (const item of STATE.gravity.winningLine) {
          const pos = getCellPos(item.r, item.c);
          ctx2D.beginPath();
          ctx2D.arc(pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize * 0.45, 0, Math.PI * 2);
          ctx2D.strokeStyle = '#38bdf8';
          ctx2D.lineWidth = 3.5;
          ctx2D.stroke();
        }
      }
    }

    

function drawLastMoveMarker2D(cx, cy, radius) {
      ctx2D.beginPath(); ctx2D.arc(cx, cy, radius * 0.46, 0, Math.PI * 2);
      ctx2D.strokeStyle = '#ffffff'; ctx2D.lineWidth = 2.5; ctx2D.stroke();
      ctx2D.beginPath(); ctx2D.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
      ctx2D.fillStyle = '#ffffff'; ctx2D.fill();
    }

    function drawGravityPiece2D(cx, cy, radius, player) {
      const grad = ctx2D.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
      if (player === 1) {
        grad.addColorStop(0, '#ff9fa8'); grad.addColorStop(0.3, '#ff4757'); grad.addColorStop(1, '#8b0015');
      } else {
        grad.addColorStop(0, '#fef08a'); grad.addColorStop(0.3, '#eab308'); grad.addColorStop(1, '#713f12');
      }
      ctx2D.beginPath(); ctx2D.arc(cx, cy, radius, 0, Math.PI * 2); ctx2D.fillStyle = grad; ctx2D.fill();
      ctx2D.beginPath(); ctx2D.arc(cx - radius * 0.28, cy - radius * 0.32, radius * 0.22, 0, Math.PI * 2);
      ctx2D.fillStyle = 'rgba(255, 255, 255, 0.45)'; ctx2D.fill();
    }

    

function getPointerCoord2D(e) {
  const rect = canvas2D.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { px: clientX - rect.left, py: clientY - rect.top };
}

canvas2D.addEventListener('pointermove', (e) => {
  if (STATE.winner || STATE.animating) return;
  const { px } = getPointerCoord2D(e);
  let col = Math.floor(px / (cellSize + grooveSize));
  STATE.gravity.hoverCol = (col >= 0 && col < 9) ? col : null;
  render2D();
});

canvas2D.addEventListener('pointerleave', () => {
  STATE.gravity.hoverCol = null;
  render2D();
});

canvas2D.addEventListener('click', (e) => {
  if (STATE.winner || STATE.animating) return;
  const { px } = getPointerCoord2D(e);
  let col = Math.floor(px / (cellSize + grooveSize));
  if (col >= 0 && col < 9) dropGravityCol(col);
});

window.addEventListener('resize', () => {
  resizeCanvas2D();
  render2D();
});

window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('GRAVITY');
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  } else {
    resetCurrentGame();
  }
});
