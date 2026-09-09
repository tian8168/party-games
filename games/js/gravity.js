
let canvas2D, ctx2D;
function getCanvas2DCtx() {
  canvas2D = document.getElementById('board-canvas');
  if (canvas2D) ctx2D = canvas2D.getContext('2d');
  return canvas2D && ctx2D;
}
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
  if (!getCanvas2DCtx()) return;
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
      if (!getCanvas2DCtx()) return;
      if (typeof initCanvas2DListeners === 'function') initCanvas2DListeners();
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

    // ==========================================================================
