    // 7. 拔刀居合斩核心逻辑 (IAIDO)
    // ==========================================================================
    function initIaidoGame() {
      if (STATE.iaido.modalTimer) clearTimeout(STATE.iaido.modalTimer);
      if (STATE.iaido.timer) clearTimeout(STATE.iaido.timer);
      if (STATE.iaido.aiTimer) clearTimeout(STATE.iaido.aiTimer);
      if (STATE.iaido.roundTimer) clearTimeout(STATE.iaido.roundTimer);
      STATE.iaido.p1Wins = 0;
      STATE.iaido.p2Wins = 0;
      STATE.iaido.roundNum = 1;
      STATE.iaido.state = 'IDLE';
      updateIaidoHUD();
      startIaidoRound();
    }

    function updateIaidoHUD() {
      const p1Hearts = '⚔️'.repeat(STATE.iaido.p1Wins) + '⚪'.repeat(Math.max(0, 3 - STATE.iaido.p1Wins));
      const p2Hearts = '⚔️'.repeat(STATE.iaido.p2Wins) + '⚪'.repeat(Math.max(0, 3 - STATE.iaido.p2Wins));
      document.getElementById('iaido-p1-life').textContent = p1Hearts;
      document.getElementById('iaido-p2-life').textContent = p2Hearts;
      document.getElementById('iaido-round-badge').textContent = `第 ${STATE.iaido.roundNum} 回合 (抢3胜)`;

      const p2Name = document.getElementById('iaido-p2-name');
      if (p2Name) {
        p2Name.textContent = STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🔵 剑客P2';
      }

      const hintP1 = document.getElementById('hint-p1-tag');
      const hintP2 = document.getElementById('hint-p2-tag');
      if (hintP1) {
        hintP1.textContent = STATE.gameMode === 'AI' ? '🔴 出刀区 (点击 / 空格)' : '🔴 P1 (按 A / 空格)';
      }
      if (hintP2) {
        hintP2.textContent = STATE.gameMode === 'AI' ? '🤖 电脑对手' : '🔵 P2 (按 L / 回车)';
      }

      if (typeof updateScoreboard === 'function') updateScoreboard();
    }

    function startIaidoRound() {
      if (STATE.iaido.timer) clearTimeout(STATE.iaido.timer);
      if (STATE.iaido.aiTimer) clearTimeout(STATE.iaido.aiTimer);
      if (STATE.iaido.roundTimer) clearTimeout(STATE.iaido.roundTimer);
      STATE.iaido.state = 'WAITING';
      document.getElementById('iaido-slash-overlay').style.display = 'none';
      document.getElementById('iaido-slash-line').style.display = 'none';
      document.getElementById('iaido-prompt').textContent = '心如止水... 伺机而动';
      document.getElementById('iaido-sub-prompt').textContent = STATE.gameMode === 'AI'
        ? '屏息凝神！出现「斬」字瞬间触碰屏幕或按空格'
        : '屏息凝神！出现「斬」字瞬间出刀！P1: A/空格，P2: L/回车';

      AUDIO.play('heartbeat');

      const waitMs = 2200 + Math.random() * 3200;
      STATE.iaido.timer = setTimeout(() => {
        if (STATE.currentGame !== 'IAIDO' || STATE.iaido.state !== 'WAITING') return;
        STATE.iaido.state = 'SIGNAL';
        STATE.iaido.signalTime = performance.now();
        document.getElementById('iaido-slash-overlay').style.display = 'flex';
        AUDIO.play('draw_signal');

        if (STATE.gameMode === 'AI') {
          const aiReaction = 210 + Math.floor(Math.random() * 110);
          STATE.iaido.aiTimer = setTimeout(() => {
            if (STATE.iaido.state === 'SIGNAL') {
              resolveIaidoWinner('P2', aiReaction);
            }
          }, aiReaction);
        }
      }, waitMs);
    }

    function handleIaidoAction(player) {
      AUDIO.init();
      if (STATE.iaido.state === 'WAITING') {
        clearTimeout(STATE.iaido.timer);
        if (STATE.iaido.aiTimer) clearTimeout(STATE.iaido.aiTimer);
        STATE.iaido.state = 'RESOLVED';
        AUDIO.play('false_start');
        document.getElementById('iaido-prompt').textContent = '⚠️ 抢跑犯规！';

        if (player === 'P1') {
          STATE.iaido.p2Wins++;
          const p2Label = STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🔵 剑客P2';
          document.getElementById('iaido-sub-prompt').textContent = `太早拔刀！🔴 P1 抢跑犯规！${p2Label} 斩获 1 胜！`;
        } else {
          STATE.iaido.p1Wins++;
          document.getElementById('iaido-sub-prompt').textContent = '太早拔刀！🔵 P2 抢跑犯规！🔴 剑客P1 斩获 1 胜！';
        }
        finishIaidoRound();
      } else if (STATE.iaido.state === 'SIGNAL') {
        const reactionMs = Math.round(performance.now() - STATE.iaido.signalTime);
        if (STATE.iaido.aiTimer) clearTimeout(STATE.iaido.aiTimer);
        STATE.iaido.state = 'RESOLVED';
        resolveIaidoWinner(player, reactionMs);
      }
    }

    function handleIaidoTap() {
      handleIaidoAction('P1');
    }

    function resolveIaidoWinner(winner, winnerMs) {
      document.getElementById('iaido-slash-overlay').style.display = 'none';
      const slashLine = document.getElementById('iaido-slash-line');
      slashLine.style.display = 'block';
      AUDIO.play('slash');

      if (winner === 'P1') {
        STATE.iaido.p1Wins++;
        document.getElementById('iaido-prompt').textContent = '⚡ 绝杀一闪！';
        document.getElementById('iaido-sub-prompt').textContent = `极速反应: ${winnerMs} 毫秒！🔴 P1 斩下 1 胜！`;
      } else {
        STATE.iaido.p2Wins++;
        const p2Label = STATE.gameMode === 'AI' ? '🔵 恶魔AI' : '🔵 P2';
        document.getElementById('iaido-prompt').textContent = STATE.gameMode === 'AI' ? '💥 慢了一步！' : '⚡ 绝杀一闪！';
        document.getElementById('iaido-sub-prompt').textContent = `极速反应: ${winnerMs} 毫秒！${p2Label} 斩下 1 胜！`;
      }

      finishIaidoRound();
    }

    function finishIaidoRound() {
      updateIaidoHUD();
      if (STATE.iaido.p1Wins >= STATE.iaido.targetWins || STATE.iaido.p2Wins >= STATE.iaido.targetWins) {
        STATE.iaido.state = 'OVER';
        if (STATE.iaido.modalTimer) clearTimeout(STATE.iaido.modalTimer);
        STATE.iaido.modalTimer = setTimeout(() => {
          let winMsg = '';
          if (STATE.gameMode === 'AI') {
            winMsg = STATE.iaido.p1Wins >= STATE.iaido.targetWins
              ? '🏆 恭喜！你以高超剑术斩落对手，问鼎剑圣！'
              : '💀 惜败！对手刀光更快一筹，再接再厉！';
          } else {
            winMsg = STATE.iaido.p1Wins >= STATE.iaido.targetWins
              ? '🏆 恭喜 🔴 剑客P1 刀光夺魄，问鼎剑圣！'
              : '🏆 恭喜 🔵 剑客P2 刀光夺魄，问鼎剑圣！';
          }
          showModal('决斗落幕', winMsg);
        }, 1000);
      } else {
        STATE.iaido.roundNum++;
        if (STATE.iaido.roundTimer) clearTimeout(STATE.iaido.roundTimer);
        STATE.iaido.roundTimer = setTimeout(startIaidoRound, 2400);
      }
    }

    function resetIaidoMatch() {
      initIaidoGame();
    }

    function setupIaidoInputs() {
      const p1Zone = document.getElementById('iaido-touch-p1');
      const p2Zone = document.getElementById('iaido-touch-p2');

      if (p1Zone) {
        p1Zone.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          handleIaidoAction('P1');
        });
      }

      if (p2Zone) {
        p2Zone.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (STATE.gameMode === 'LOCAL') {
            handleIaidoAction('P2');
          } else {
            handleIaidoAction('P1');
          }
        });
      }

      window.addEventListener('keydown', (e) => {
        if (STATE.currentGame !== 'IAIDO') return;
        const code = e.code;
        const key = e.key;

        if (code === 'Space' || code === 'KeyA' || code === 'KeyL' || code === 'Enter' || key === ' ' || key === 'Enter') {
          e.preventDefault();
        }

        // P1: KeyA, Space
        if (code === 'KeyA' || code === 'Space' || key === 'a' || key === 'A' || key === ' ') {
          handleIaidoAction('P1');
        }
        // P2: KeyL, Enter (only in LOCAL mode)
        else if (STATE.gameMode === 'LOCAL' && (code === 'KeyL' || code === 'Enter' || key === 'l' || key === 'L' || key === 'Enter')) {
          handleIaidoAction('P2');
        }
      });
    }

    // ==========================================================================
