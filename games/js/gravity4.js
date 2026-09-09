    // 3b. 2D 重力四子棋核心逻辑 (CONNECT FOUR - GRAVITY4: 7列6行)
    // ==========================================================================
    function getGravity4CellPos(r, c) {
      const totalBoardH = 6 * cellSize + 5 * grooveSize;
      const h = canvas2D.getBoundingClientRect().height || 480;
      const topMargin = Math.max(offset, (h - totalBoardH) / 2);
      return {
        x: offset + c * (cellSize + grooveSize),
        y: topMargin + r * (cellSize + grooveSize),
        topMargin
      };
    }

    function getGravity4LandingRow(col) {
      const board = STATE.gravity4.board;
      for (let r = 5; r >= 0; r--) {
        if (board[r][col] === 0) return r;
      }
      return -1;
    }

    function checkGravity4Win(r, c, player) {
      const board = STATE.gravity4.board;
      const dirs = [{ dr: 0, dc: 1 }, { dr: 1, dc: 0 }, { dr: 1, dc: 1 }, { dr: 1, dc: -1 }];
      for (const d of dirs) {
        let line = [{ r, c }];
        let step = 1;
        while (true) {
          const nr = r + d.dr * step, nc = c + d.dc * step;
          if (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && board[nr][nc] === player) { line.push({ r: nr, c: nc }); step++; }
          else break;
        }
        step = 1;
        while (true) {
          const nr = r - d.dr * step, nc = c - d.dc * step;
          if (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && board[nr][nc] === player) { line.push({ r: nr, c: nc }); step++; }
          else break;
        }
        if (line.length >= 4) return line;
      }
      return null;
    }

    function dropGravity4Col(col) {
      if (STATE.winner || STATE.animating) return;
      if (!checkIsMyTurn()) {
        if (STATE.gameMode === 'AI') showToast('🤖 电脑 AI 正在思考，请稍候...');
        return;
      }
      const targetRow = getGravity4LandingRow(col);
      if (targetRow === -1) { showToast('⚠️ 该列已堆满！'); return; }
      executeGravity4Drop(col, targetRow, STATE.turn, true);
    }

    function executeGravity4Drop(col, targetRow, player, isLocalAction = false) {
      STATE.animating = true;
      const targetPos = getGravity4CellPos(targetRow, col);
      const startY = targetPos.topMargin - cellSize;
      const targetY = targetPos.y;

      let curY = startY;
      let vy = 4;
      const gravityAcc = 1.9;

      function animStep() {
        vy += gravityAcc;
        curY += vy;
        if (curY >= targetY) {
          AUDIO.play('drop');
          curY = targetY;
          STATE.gravity4.board[targetRow][col] = player;
          STATE.gravity4.lastMove = { r: targetRow, c: col, player };
          STATE.gravity4.animatingPiece = null;
          STATE.animating = false;

          const winLine = checkGravity4Win(targetRow, col, player);
          if (winLine) {
            AUDIO.play('win');
            STATE.winner = player;
            STATE.gravity4.winningLine = winLine;
            const pName = player === 1 ? '🔴 红方' : '🟡 黄方';
            showModal('🎉 经典四子连珠绝杀！', `${pName} 成功率先连成 4 颗同色棋子，赢得 7×6 经典对决！`);
          } else {
            let full = true;
            for (let c = 0; c < 7; c++) {
              if (STATE.gravity4.board[0][c] === 0) { full = false; break; }
            }
            if (full) {
              STATE.winner = 3;
              showModal('🤝 势均力敌', '42 个棋格已全部填满，双方达成平局！');
            } else {
              endTurn();
            }
          }

          if (isLocalAction && STATE.gameMode === 'ONLINE') {
            sendOnlineAction({ type: 'GRAVITY4_DROP', col });
          }
          render2D();
        } else {
          STATE.gravity4.animatingPiece = { col, curY, player };
          render2D();
          requestAnimationFrame(animStep);
        }
      }
      requestAnimationFrame(animStep);
    }

    function runGravity4AI() {
      if (STATE.winner) return;
      const board = STATE.gravity4.board;
      let bestCol = -1, maxScore = -Infinity;

      for (let c = 0; c < 7; c++) {
        const r = getGravity4LandingRow(c);
        if (r === -1) continue;

        let score = 0;
        // 1. AI 自身一步获胜
        board[r][c] = 2;
        if (checkGravity4Win(r, c, 2)) { board[r][c] = 0; executeGravity4Drop(c, r, 2); return; }
        board[r][c] = 0;

        // 2. 阻挡玩家 1 一步获胜
        board[r][c] = 1;
        if (checkGravity4Win(r, c, 1)) score += 15000;
        board[r][c] = 0;

        // 3. 避免给对手制造上方直接获胜机会
        if (r > 0) {
          board[r - 1][c] = 1;
          if (checkGravity4Win(r - 1, c, 1)) score -= 12000;
          board[r - 1][c] = 0;
        }

        // 4. 经典四子棋黄金中路加权 (中心列 c=3 价值最高，向两侧递减)
        score += (3 - Math.abs(c - 3)) * 18 + r * 4;
        if (score > maxScore) { maxScore = score; bestCol = c; }
      }

      if (bestCol !== -1) {
        const tr = getGravity4LandingRow(bestCol);
        executeGravity4Drop(bestCol, tr, 2);
      }
    }

    function renderGravity4() {
      const w = canvas2D.getBoundingClientRect().width;
      const h = canvas2D.getBoundingClientRect().height;
      const totalBoardH = 6 * cellSize + 5 * grooveSize;
      const topMargin = Math.max(offset, (h - totalBoardH) / 2);

      // 经典桌游蓝色面板框
      ctx2D.fillStyle = '#172554';
      ctx2D.beginPath();
      ctx2D.roundRect(offset - 6, topMargin - 6, 7 * cellSize + 6 * grooveSize + 12, totalBoardH + 12, 14);
      ctx2D.fill();
      ctx2D.strokeStyle = '#3b82f6';
      ctx2D.lineWidth = 2.5;
      ctx2D.stroke();

      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
          const pos = getGravity4CellPos(r, c);
          const cx = pos.x + cellSize / 2, cy = pos.y + cellSize / 2, radius = cellSize * 0.42;

          // 镂空圆槽底色与内阴影
          ctx2D.beginPath();
          ctx2D.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx2D.fillStyle = '#090d16';
          ctx2D.fill();
          ctx2D.strokeStyle = '#1e3a8a';
          ctx2D.lineWidth = 1.5;
          ctx2D.stroke();

          const piece = STATE.gravity4.board[r][c];
          if (piece !== 0) {
            drawGravityPiece2D(cx, cy, radius, piece);
            if (STATE.gravity4.lastMove && STATE.gravity4.lastMove.r === r && STATE.gravity4.lastMove.c === c) {
              drawLastMoveMarker2D(cx, cy, radius);
            }
          }
        }
      }

      // 下落动画球
      if (STATE.gravity4.animatingPiece) {
        const ap = STATE.gravity4.animatingPiece;
        const pos = getGravity4CellPos(0, ap.col);
        drawGravityPiece2D(pos.x + cellSize / 2, ap.curY + cellSize / 2, cellSize * 0.42, ap.player);
      }

      // 悬停落点虚影
      if (STATE.gravity4.hoverCol !== null && !STATE.winner && checkIsMyTurn() && !STATE.animating) {
        const tr = getGravity4LandingRow(STATE.gravity4.hoverCol);
        if (tr !== -1) {
          const pos = getGravity4CellPos(tr, STATE.gravity4.hoverCol);
          ctx2D.beginPath();
          ctx2D.arc(pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize * 0.42, 0, Math.PI * 2);
          ctx2D.fillStyle = STATE.turn === 1 ? 'rgba(255, 71, 87, 0.35)' : 'rgba(241, 196, 15, 0.35)';
          ctx2D.fill();
        }
      }

      // 获胜连线高亮
      if (STATE.gravity4.winningLine) {
        for (const item of STATE.gravity4.winningLine) {
          const pos = getGravity4CellPos(item.r, item.c);
          ctx2D.beginPath();
          ctx2D.arc(pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize * 0.45, 0, Math.PI * 2);
          ctx2D.strokeStyle = '#38bdf8';
          ctx2D.lineWidth = 4;
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

    // 2D 画布事件监听
    let canvas2DListenersBound = false;
    function initCanvas2DListeners() {
      const cvs = document.getElementById('board-canvas');
      if (!cvs || canvas2DListenersBound) return;
      canvas2DListenersBound = true;

      function getPointerCoord2D(e) {
        const rect = cvs.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { px: clientX - rect.left, py: clientY - rect.top };
      }

      cvs.addEventListener('pointermove', (e) => {
        if (STATE.winner || STATE.animating) return;
        const { px, py } = getPointerCoord2D(e);

        if (STATE.currentGame === 'QUORIDOR') {
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
        } else if (STATE.currentGame === 'GRAVITY') {
          let col = Math.floor(px / (cellSize + grooveSize));
          STATE.gravity.hoverCol = (col >= 0 && col < 9) ? col : null;
        } else if (STATE.currentGame === 'GRAVITY4') {
          let col = Math.floor(px / (cellSize + grooveSize));
          STATE.gravity4.hoverCol = (col >= 0 && col < 7) ? col : null;
        }
        render2D();
      });

      cvs.addEventListener('pointerleave', () => {
        STATE.quoridor.hoverPos = null;
        STATE.gravity.hoverCol = null;
        if (STATE.gravity4) STATE.gravity4.hoverCol = null;
        render2D();
      });

      cvs.addEventListener('click', (e) => {
        if (STATE.winner || STATE.animating) return;
        const { px, py } = getPointerCoord2D(e);

        if (STATE.currentGame === 'QUORIDOR') {
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
        } else if (STATE.currentGame === 'GRAVITY') {
          let col = Math.floor(px / (cellSize + grooveSize));
          if (col >= 0 && col < 9) dropGravityCol(col);
        } else if (STATE.currentGame === 'GRAVITY4') {
          let col = Math.floor(px / (cellSize + grooveSize));
          if (col >= 0 && col < 7) dropGravity4Col(col);
        }
      });
    }

    // ==========================================================================
