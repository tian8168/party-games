    // ==========================================================================
    // 2. 步步为营逻辑 (QUORIDOR)
    // ==========================================================================
// const canvas2D = document.getElementById('board-canvas'); - moved into functions
// const ctx2D = canvas2D.getContext('2d'); - moved into functions
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

    // ==========================================================================
