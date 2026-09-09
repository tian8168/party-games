// ==========================================================================
// ⚡ 拔刀居合斩 (Iaido Slash) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'IAIDO';
window.GAME_RULES = {
  'IAIDO': {"title":"拔刀居合斩 规则","body":"<p><strong>屏息凝神：</strong>屏幕变暗等待，切勿提前触碰，<strong>抢跑直接判负！</strong></p><br>\n           <p><strong>一击必杀：</strong>红光闪现「斬」字瞬间，以极限手速点击屏幕，快 1 毫秒者胜！率先赢下 3 胜者问鼎剑圣！</p>"}
};

const STATE = {

      currentGame: 'IAIDO',
      gameMode: 'AI',
      iaido: {
        state: 'IDLE',
        p1Wins: 0,
        p2Wins: 0,
        targetWins: 3,
        timer: null,
        signalTime: 0,
        roundNum: 1
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
  resetIaidoMatch();
}

// --- 游戏专属引擎核心逻辑 ---
// 7. 拔刀居合斩核心逻辑 (IAIDO)
    // ==========================================================================
    function initIaidoGame() {
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
    }

    function startIaidoRound() {
      if (STATE.iaido.timer) clearTimeout(STATE.iaido.timer);
      STATE.iaido.state = 'WAITING';
      document.getElementById('iaido-slash-overlay').style.display = 'none';
      document.getElementById('iaido-slash-line').style.display = 'none';
      document.getElementById('iaido-prompt').textContent = '心如止水... 伺机而动';
      document.getElementById('iaido-sub-prompt').textContent = '屏息凝神！出现「斬」字瞬间点击屏幕';

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
              resolveIaidoWinner('P2', aiReaction, null);
            }
          }, aiReaction);
        }
      }, waitMs);
    }

    function handleIaidoTap() {
      AUDIO.init();
      if (STATE.iaido.state === 'WAITING') {
        clearTimeout(STATE.iaido.timer);
        STATE.iaido.state = 'RESOLVED';
        AUDIO.play('false_start');
        document.getElementById('iaido-prompt').textContent = '⚠️ 抢跑犯规！';
        document.getElementById('iaido-sub-prompt').textContent = '太早拔刀被对手斩于马下！🔵 对方得 1 分';
        STATE.iaido.p2Wins++;
        finishIaidoRound();
      } else if (STATE.iaido.state === 'SIGNAL') {
        const p1Reaction = Math.round(performance.now() - STATE.iaido.signalTime);
        if (STATE.iaido.aiTimer) clearTimeout(STATE.iaido.aiTimer);
        STATE.iaido.state = 'RESOLVED';
        resolveIaidoWinner('P1', p1Reaction, null);
      }
    }

    function resolveIaidoWinner(winner, winnerMs, loserMs) {
      document.getElementById('iaido-slash-overlay').style.display = 'none';
      const slashLine = document.getElementById('iaido-slash-line');
      slashLine.style.display = 'block';
      AUDIO.play('slash');

      if (winner === 'P1') {
        STATE.iaido.p1Wins++;
        document.getElementById('iaido-prompt').textContent = '⚡ 绝杀一闪！';
        document.getElementById('iaido-sub-prompt').textContent = `极速反应: ${winnerMs} 毫秒！🔴 玩家斩下 1 胜！`;
      } else {
        STATE.iaido.p2Wins++;
        document.getElementById('iaido-prompt').textContent = '💥 慢了一步！';
        document.getElementById('iaido-sub-prompt').textContent = `对手反应: ${winnerMs} 毫秒！🔵 对手斩下 1 胜！`;
      }

      finishIaidoRound();
    }

    function finishIaidoRound() {
      updateIaidoHUD();
      if (STATE.iaido.p1Wins >= STATE.iaido.targetWins || STATE.iaido.p2Wins >= STATE.iaido.targetWins) {
        STATE.iaido.state = 'OVER';
        setTimeout(() => {
          const isP1 = STATE.iaido.p1Wins >= STATE.iaido.targetWins;
          showModal('决斗落幕', isP1 ? '🏆 恭喜！你以高超剑术斩落对手，问鼎剑圣！' : '💀 惜败！对手刀光更快一筹，再接再厉！');
        }, 1000);
      } else {
        STATE.iaido.roundNum++;
        setTimeout(startIaidoRound, 2400);
      }
    }

    function resetIaidoMatch() {
      initIaidoGame();
    }

    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('IAIDO');
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  } else {
    resetCurrentGame();
  }
});
