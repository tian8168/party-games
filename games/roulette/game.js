// ==========================================================================
// 🎲 恶魔轮盘赌 (Buckshot Roulette) · 独立游戏逻辑 (Isolated Game Engine)
// ==========================================================================

window.GAME_KEY = 'ROULETTE';
window.GAME_RULES = {
  'ROULETTE': {"title":"恶魔轮盘赌 规则","body":"<p><strong>枪膛与子弹：</strong>每轮装入已知数量的 🔴 实弹 与 ⚪ 空包弹，轮流开枪。</p><br>\n           <p><strong>核心机制：</strong></p>\n           <ul>\n             <li><b>开枪打对手：</b>若是实弹扣除对方生命值；若是空包弹则安然无恙并换对手回合。</li>\n             <li><b>开枪打自己：</b>若是空包弹，<b>你将获得额外一次行动回合！</b> 若是实弹则扣自己血。</li>\n           </ul><br>\n           <p><strong>道具功效：</strong>🔍 放大镜看下一发真假；🔒 手铐锁住对手下回合；🪚 手锯造成2倍实弹伤害；🍺 啤酒退出一发弹；🚬 香烟回血。</p>"}
};

const STATE = {

      currentGame: 'ROULETTE',
      gameMode: 'AI',
      turn: 1,
      winner: null,
      animating: false,
      online: { roomId: null, myRole: null, connected: false, mqttClient: null, opponentJoined: false },
      roulette: {
        p1Hp: 4,
        p2Hp: 4,
        maxHp: 4,
        shells: [],
        sawed: false,
        p1Cuffed: false,
        p2Cuffed: false,
        p1Items: [],
        p2Items: [],
        knownNext: null
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
  initRouletteGame();
}

// --- 游戏专属引擎核心逻辑 ---
// 5. 恶魔轮盘赌 (BUCKSHOT ROULETTE)
    // ==========================================================================
    const ROULETTE_ITEM_DEFS = {
      'MAGNIFIER': { name: '🔍 放大镜', desc: '偷看下一发真假' },
      'HANDCUFFS': { name: '🔒 手铐', desc: '封锁对方下回合' },
      'SAW': { name: '🪚 手锯', desc: '下发实弹2倍伤害' },
      'BEER': { name: '🍺 啤酒', desc: '退出当前子弹' },
      'CIGARETTE': { name: '🚬 香烟', desc: '恢复1点生命值' }
    };

    function initRouletteGame() {
      STATE.roulette.p1Hp = 4;
      STATE.roulette.p2Hp = 4;
      STATE.roulette.p1Items = ['MAGNIFIER', 'BEER', 'SAW'];
      STATE.roulette.p2Items = ['MAGNIFIER', 'HANDCUFFS', 'CIGARETTE'];
      STATE.roulette.sawed = false;
      STATE.roulette.p1Cuffed = false;
      STATE.roulette.p2Cuffed = false;
      STATE.roulette.knownNext = null;
      dealRouletteRound();
    }

    function dealRouletteRound() {
      AUDIO.play('rack');
      // 随机生成 2~4 发实弹与 2~4 发空包弹
      const liveCount = Math.floor(Math.random() * 3) + 2; // 2..4
      const blankCount = Math.floor(Math.random() * 3) + 2; // 2..4

      const shells = [];
      for (let i = 0; i < liveCount; i++) shells.push(true);
      for (let i = 0; i < blankCount; i++) shells.push(false);
      // Fisher-Yates 洗牌
      for (let i = shells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shells[i], shells[j]] = [shells[j], shells[i]];
      }
      STATE.roulette.shells = shells;
      STATE.roulette.sawed = false;
      STATE.roulette.knownNext = null;

      // 补充随机道具（最多6个）
      const itemKeys = Object.keys(ROULETTE_ITEM_DEFS);
      if (STATE.roulette.p1Items.length < 6) {
        STATE.roulette.p1Items.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]);
      }
      if (STATE.roulette.p2Items.length < 6) {
        STATE.roulette.p2Items.push(itemKeys[Math.floor(Math.random() * itemKeys.length)]);
      }

      renderRouletteUI(`新一轮装弹：🔴 ${liveCount} 发实弹 · ⚪ ${blankCount} 发空包弹`);
      showToast(`🔫 新一轮开始！已装入 🔴 ${liveCount} 实弹，⚪ ${blankCount} 空包弹！`, 4000);
    }

    function renderRouletteUI(infoText) {
      // 渲染血量
      const renderHearts = (hp, maxHp = 4) => {
        let html = '';
        for (let i = 0; i < maxHp; i++) {
          html += `<span class="hp-heart ${i < hp ? '' : 'empty'}">❤️</span>`;
        }
        return html;
      };
      document.getElementById('roulette-player-hp').innerHTML = renderHearts(STATE.roulette.p1Hp);
      document.getElementById('roulette-opp-hp').innerHTML = renderHearts(STATE.roulette.p2Hp);

      // 渲染名称与角色
      document.getElementById('roulette-player-name').textContent = STATE.gameMode === 'ONLINE' && STATE.online.myRole === 'guest' ? '👤 绿方 (客方)' : '👤 红方 (你)';
      document.getElementById('roulette-opp-name').textContent = STATE.gameMode === 'AI' ? '🤖 恶魔荷官 (AI)' : (STATE.gameMode === 'ONLINE' ? '👤 对方玩家' : '👤 对手 (P2)');

      if (infoText) document.getElementById('roulette-round-info').textContent = infoText;

      document.getElementById('roulette-saw-badge').style.display = STATE.roulette.sawed ? 'block' : 'none';
      document.getElementById('roulette-cuffed-opp').style.display = STATE.roulette.p2Cuffed ? 'block' : 'none';
      document.getElementById('roulette-cuffed-player').style.display = STATE.roulette.p1Cuffed ? 'block' : 'none';

      // 渲染当前玩家道具
      const itemsContainer = document.getElementById('roulette-items-container');
      itemsContainer.innerHTML = '';
      const myItems = STATE.turn === 1 ? STATE.roulette.p1Items : STATE.roulette.p2Items;
      if (myItems.length === 0) {
        itemsContainer.innerHTML = '<span style="font-size:0.75rem; color:#64748b; padding-left:4px;">无可用道具</span>';
      } else {
        myItems.forEach((itemKey, idx) => {
          const btn = document.createElement('button');
          btn.className = 'roulette-item-btn';
          btn.textContent = ROULETTE_ITEM_DEFS[itemKey].name;
          btn.title = ROULETTE_ITEM_DEFS[itemKey].desc;
          btn.onclick = () => useRouletteItem(idx);
          itemsContainer.appendChild(btn);
        });
      }

      // 枪口指向动画
      const gunSvg = document.getElementById('shotgun-svg');
      gunSvg.classList.toggle('aim-self', false);
      gunSvg.classList.toggle('aim-opponent', true);

      // 状态文本
      const status = document.getElementById('status-text');
      if (STATE.winner) {
        status.textContent = STATE.winner === 1 ? '🏆 玩家获得了最后的生还！' : '💀 恶魔荷官夺走了你的筹码！';
      } else {
        status.textContent = checkIsMyTurn() ? '👉 轮到你的回合：请选择射击目标或使用道具！' : '⏳ 对手正在抉择...';
      }
    }

    function useRouletteItem(itemIdx) {
      if (STATE.winner || STATE.animating) return;
      if (!checkIsMyTurn()) { showToast('⏳ 尚未轮到你的回合！'); return; }

      const isP1 = STATE.turn === 1;
      const myItems = isP1 ? STATE.roulette.p1Items : STATE.roulette.p2Items;
      const itemKey = myItems.splice(itemIdx, 1)[0];
      AUDIO.play('click');

      if (itemKey === 'MAGNIFIER') {
        const isLive = STATE.roulette.shells[0];
        STATE.roulette.knownNext = isLive;
        showModal('🔍 放大镜偷窥结果', `你悄悄旋开枪膛，看到下一发子弹是：<br><br><b style="font-size:1.3rem; color:${isLive ? '#ef4444' : '#38bdf8'}">${isLive ? '🔴 实弹 (LIVE)' : '⚪ 空包弹 (BLANK)'}</b>！`);
      } else if (itemKey === 'HANDCUFFS') {
        if (isP1) STATE.roulette.p2Cuffed = true;
        else STATE.roulette.p1Cuffed = true;
        showToast('🔒 手铐生效！对手的下一个行动回合将被跳过！');
      } else if (itemKey === 'SAW') {
        STATE.roulette.sawed = true;
        showToast('🪚 枪管已被截短！下一枪若是实弹，将造成 2 点致命伤害！');
      } else if (itemKey === 'BEER') {
        AUDIO.play('rack');
        const ejected = STATE.roulette.shells.shift();
        showToast(`🍺 咔哒！退出了当前一发子弹：【${ejected ? '🔴 实弹' : '⚪ 空包弹'}】！`);
        STATE.roulette.knownNext = null;
        if (STATE.roulette.shells.length === 0) dealRouletteRound();
      } else if (itemKey === 'CIGARETTE') {
        if (isP1) STATE.roulette.p1Hp = Math.min(STATE.roulette.maxHp, STATE.roulette.p1Hp + 1);
        else STATE.roulette.p2Hp = Math.min(STATE.roulette.maxHp, STATE.roulette.p2Hp + 1);
        showToast('🚬 深吸一口香烟，生命值 +1！');
      }

      renderRouletteUI();
      if (STATE.gameMode === 'ONLINE') sendOnlineAction({ type: 'ROULETTE_ITEM', itemKey });
    }

    function rouletteShoot(target) {
      if (STATE.winner || STATE.animating) return;
      if (!checkIsMyTurn()) {
        showToast(STATE.gameMode === 'ONLINE' && !STATE.online.opponentJoined ? '💡 请先等待好友加入房间！' : '⏳ 正在等待对方操作...');
        return;
      }
      executeRouletteShot(target, true);
    }

    function executeRouletteShot(target, isLocalAction = false) {
      STATE.animating = true;
      const isLive = STATE.roulette.shells.shift();
      STATE.roulette.knownNext = null;

      const gunSvg = document.getElementById('shotgun-svg');
      gunSvg.classList.toggle('aim-self', target === 'SELF');
      gunSvg.classList.toggle('aim-opponent', target === 'OPPONENT');

      const shooter = STATE.turn;
      const victim = target === 'SELF' ? shooter : (shooter === 1 ? 2 : 1);
      const dmg = STATE.roulette.sawed ? 2 : 1;
      STATE.roulette.sawed = false;

      setTimeout(() => {
        if (isLive) {
          AUDIO.play('shot');
          // 枪火屏幕爆闪
          const flash = document.getElementById('roulette-flash');
          flash.style.opacity = '0.95';
          setTimeout(() => { flash.style.opacity = '0'; }, 180);

          if (victim === 1) STATE.roulette.p1Hp = Math.max(0, STATE.roulette.p1Hp - dmg);
          else STATE.roulette.p2Hp = Math.max(0, STATE.roulette.p2Hp - dmg);

          showToast(`💥 轰！！是【🔴 实弹】！造成了 ${dmg} 点伤害！`);

          // 胜负判定
          if (STATE.roulette.p1Hp <= 0 || STATE.roulette.p2Hp <= 0) {
            AUDIO.play('win');
            STATE.winner = STATE.roulette.p1Hp <= 0 ? 2 : 1;
            const winName = STATE.winner === 1 ? '🔴 玩家' : '🤖 恶魔荷官/对手';
            showModal('🎉 对决终结！', `${winName} 在生死轮盘中存活到了最后，赢得对赌！`);
            STATE.animating = false;
            renderRouletteUI();
            return;
          }

          // 回合切换（考虑手铐）
          advanceRouletteTurn();
        } else {
          AUDIO.play('blank');
          showToast('💨 咔哒！是【⚪ 空包弹】！平安无事！');

          // 如果朝自己开空枪，奖励额外一次连动回合！
          if (target === 'SELF') {
            showToast('🎁 孤注一掷成功！朝自己开出空包弹，你获得【连续行动】特权！', 3500);
          } else {
            advanceRouletteTurn();
          }
        }

        if (STATE.roulette.shells.length === 0 && !STATE.winner) {
          dealRouletteRound();
        }

        STATE.animating = false;
        renderRouletteUI();

        if (isLocalAction && STATE.gameMode === 'ONLINE') {
          sendOnlineAction({ type: 'ROULETTE_SHOOT', target });
        }
      }, 400);
    }

    function advanceRouletteTurn() {
      const nextPlayer = STATE.turn === 1 ? 2 : 1;
      const isCuffed = nextPlayer === 1 ? STATE.roulette.p1Cuffed : STATE.roulette.p2Cuffed;

      if (isCuffed) {
        if (nextPlayer === 1) STATE.roulette.p1Cuffed = false;
        else STATE.roulette.p2Cuffed = false;
        showToast(`🔒 对手被手铐锁住，跳过回合！依然由你行动！`, 3000);
      } else {
        endTurn();
      }
    }

    function runRouletteAI() {
      if (STATE.winner || STATE.turn !== 2) return;
      const r = STATE.roulette;

      // 1. AI 道具使用决策
      if (r.p2Hp <= 2 && r.p2Items.includes('CIGARETTE')) {
        const idx = r.p2Items.indexOf('CIGARETTE');
        r.p2Items.splice(idx, 1);
        r.p2Hp = Math.min(r.maxHp, r.p2Hp + 1);
        showToast('🚬 恶魔荷官抽了一根香烟，恢复了 1 点生命！');
        renderRouletteUI();
      }

      if (!r.p1Cuffed && r.p2Items.includes('HANDCUFFS')) {
        const idx = r.p2Items.indexOf('HANDCUFFS');
        r.p2Items.splice(idx, 1);
        r.p1Cuffed = true;
        showToast('🔒 恶魔荷官向你掷出手铐！你的下一回合被锁定了！');
        renderRouletteUI();
      }

      if (r.p2Items.includes('MAGNIFIER') && r.knownNext === null) {
        const idx = r.p2Items.indexOf('MAGNIFIER');
        r.p2Items.splice(idx, 1);
        r.knownNext = r.shells[0];
        renderRouletteUI();
      }

      // 2. 开枪决策
      let target = 'OPPONENT';
      if (r.knownNext === true) {
        if (r.p2Items.includes('SAW') && !r.sawed) {
          const idx = r.p2Items.indexOf('SAW');
          r.p2Items.splice(idx, 1);
          r.sawed = true;
          showToast('🪚 恶魔荷官狞笑着用手锯锯断了枪管！');
          renderRouletteUI();
        }
        target = 'OPPONENT'; // 确信实弹射击玩家
      } else if (r.knownNext === false) {
        target = 'SELF'; // 确信空包弹射击自己以夺取连动回合
      } else {
        // 计算实弹概率
        const liveCount = r.shells.filter(s => s).length;
        const pLive = liveCount / r.shells.length;
        target = pLive <= 0.35 ? 'SELF' : 'OPPONENT';
      }

      setTimeout(() => {
        executeRouletteShot(target, false);
      }, 700);
    }

    // ==========================================================================
    

// --- 页面装载自动初始化 ---
window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('ROULETTE');
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  } else {
    resetCurrentGame();
  }
});
