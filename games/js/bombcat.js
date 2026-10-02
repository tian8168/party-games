/**
 * 💣 疯狂拆弹猫 (Bomb Cat / Exploding Kittens Lite)
 * 7 大精炼卡牌 · 状态机出牌与摸牌 · 本地防偷窥暗牌展开 · 智能 AI 概率决策
 */

(function() {
  'use strict';

  const CARD_DEFS = {
    BOMB: {
      id: 'BOMB',
      name: '炸弹猫',
      en: 'BOMB',
      icon: '💣',
      cssClass: 'card-bomb',
      desc: '抽到即死！除非立即打出拆弹卡'
    },
    DEFUSE: {
      id: 'DEFUSE',
      name: '拆弹卡',
      en: 'DEFUSE',
      icon: '🧯',
      cssClass: 'card-defuse',
      desc: '免死金牌，并将炸弹秘密插回牌堆'
    },
    FUTURE: {
      id: 'FUTURE',
      name: '预知未来',
      en: 'FUTURE',
      icon: '🔮',
      cssClass: 'card-future',
      desc: '私密偷看牌堆顶部的后 3 张牌'
    },
    SKIP: {
      id: 'SKIP',
      name: '甩锅跳过',
      en: 'SKIP',
      icon: '💨',
      cssClass: 'card-skip',
      desc: '免去摸牌，立即结束己方回合'
    },
    ATTACK: {
      id: 'ATTACK',
      name: '连击打击',
      en: 'ATTACK',
      icon: '⚡',
      cssClass: 'card-attack',
      desc: '免去摸牌，强迫下家连续执行2回合'
    },
    SHUFFLE: {
      id: 'SHUFFLE',
      name: '命运洗牌',
      en: 'SHUFFLE',
      icon: '🌪️',
      cssClass: 'card-shuffle',
      desc: '将剩余公共牌堆当场充分重新洗乱'
    },
    STEAL: {
      id: 'STEAL',
      name: '顺手牵羊',
      en: 'STEAL',
      icon: '🐱',
      cssClass: 'card-steal',
      desc: '指定一名存活对手，盲抽其1张手牌'
    }
  };

  const BOMB_STATE = {
    mode: 'AI1', // 'AI1', 'AI3', 'LOCAL2', 'LOCAL4'
    players: [],
    turnIndex: 0,
    extraTurns: 0, // 当前玩家额外需执行的回合数 (连击惩罚)
    deck: [],
    discardPile: [],
    phase: 'PLAYING', // 'PLAYING', 'DEFUSE_INSERT', 'FUTURE_VIEW', 'STEAL_SELECT', 'GAME_OVER'
    antiPeekHeld: false,
    handRevealed: false,
    selectedCardIdx: -1,
    aiTimer: null,
    turnTimer: null,
    roundTimer: null,
    pendingBombPlayer: null,
    knownTopCards: null // AI 记录已窥视的顶牌
  };

  // ==========================================================================
  // 初始化与牌堆构建
  // ==========================================================================

  function initPlayers() {
    let configs = [];
    if (BOMB_STATE.mode === 'AI1') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (主)', isAi: false },
        { id: 2, name: '🟢 电脑 2 (AI)', isAi: true }
      ];
    } else if (BOMB_STATE.mode === 'AI3') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (主)', isAi: false },
        { id: 2, name: '🟢 电脑 2 (AI)', isAi: true },
        { id: 3, name: '🔵 电脑 3 (AI)', isAi: true },
        { id: 4, name: '🟡 电脑 4 (AI)', isAi: true }
      ];
    } else if (BOMB_STATE.mode === 'LOCAL2') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (主)', isAi: false },
        { id: 2, name: '🟢 玩家 2 (客)', isAi: false }
      ];
    } else if (BOMB_STATE.mode === 'LOCAL4') {
      configs = [
        { id: 1, name: '🔴 玩家 1', isAi: false },
        { id: 2, name: '🟢 玩家 2', isAi: false },
        { id: 3, name: '🔵 玩家 3', isAi: false },
        { id: 4, name: '🟡 玩家 4', isAi: false }
      ];
    }

    BOMB_STATE.players = configs.map(cfg => ({
      ...cfg,
      alive: true,
      hand: []
    }));
  }

  function setupNewDeck() {
    const numPlayers = BOMB_STATE.players.length;

    // 1. 每名玩家保底发 1 张【拆弹卡】
    BOMB_STATE.players.forEach(p => {
      p.alive = true;
      p.hand = ['DEFUSE'];
    });

    // 2. 初始非炸弹功能牌池 (用于发初始4张手牌)
    const initialPool = [
      'FUTURE', 'FUTURE', 'FUTURE', 'FUTURE', 'FUTURE',
      'SKIP', 'SKIP', 'SKIP', 'SKIP',
      'ATTACK', 'ATTACK', 'ATTACK', 'ATTACK',
      'SHUFFLE', 'SHUFFLE', 'SHUFFLE', 'SHUFFLE',
      'STEAL', 'STEAL', 'STEAL', 'STEAL'
    ];
    shuffleArray(initialPool);

    // 每人随机抽取 4 张初始手牌
    BOMB_STATE.players.forEach(p => {
      for (let i = 0; i < 4; i++) {
        if (initialPool.length > 0) {
          p.hand.push(initialPool.pop());
        }
      }
    });

    // 3. 构建公用摸牌堆：N-1 张【炸弹猫】 + 2 张剩余【拆弹卡】 + 剩余功能牌
    const finalDeck = [...initialPool];
    // 放入 N - 1 张炸弹
    const bombsCount = numPlayers - 1;
    for (let i = 0; i < bombsCount; i++) {
      finalDeck.push('BOMB');
    }
    // 额外放入 2 张拆弹卡 (供对局中幸运摸到)
    finalDeck.push('DEFUSE');
    finalDeck.push('DEFUSE');

    shuffleArray(finalDeck);

    BOMB_STATE.deck = finalDeck;
    BOMB_STATE.discardPile = [];
    BOMB_STATE.turnIndex = 0;
    BOMB_STATE.extraTurns = 0;
    BOMB_STATE.phase = 'PLAYING';
    BOMB_STATE.selectedCardIdx = -1;
    BOMB_STATE.knownTopCards = null;
    BOMB_STATE.handRevealed = false;
    BOMB_STATE.antiPeekHeld = false;

    if (BOMB_STATE.aiTimer) {
      clearTimeout(BOMB_STATE.aiTimer);
      BOMB_STATE.aiTimer = null;
    }
    if (BOMB_STATE.turnTimer) {
      clearTimeout(BOMB_STATE.turnTimer);
      BOMB_STATE.turnTimer = null;
    }
    if (BOMB_STATE.roundTimer) {
      clearTimeout(BOMB_STATE.roundTimer);
      BOMB_STATE.roundTimer = null;
    }
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // ==========================================================================
  // 回合行动流转与状态机
  // ==========================================================================

  function getActivePlayer() {
    return BOMB_STATE.players[BOMB_STATE.turnIndex];
  }

  function advanceTurn() {
    if (BOMB_STATE.phase === 'GAME_OVER') return;

    // 如果当前玩家还在被连击惩罚中，且依然存活
    const cur = getActivePlayer();
    if (cur && cur.alive && BOMB_STATE.extraTurns > 0) {
      BOMB_STATE.extraTurns--;
      updateUI();
      checkCurrentPlayerTurn();
      return;
    }

    // 轮换至下一名存活玩家
    const n = BOMB_STATE.players.length;
    let nextIdx = (BOMB_STATE.turnIndex + 1) % n;
    while (!BOMB_STATE.players[nextIdx].alive) {
      nextIdx = (nextIdx + 1) % n;
    }

    BOMB_STATE.turnIndex = nextIdx;
    BOMB_STATE.extraTurns = 0;
    BOMB_STATE.selectedCardIdx = -1;
    BOMB_STATE.handRevealed = false;
    BOMB_STATE.antiPeekHeld = false;

    updateUI();
    checkCurrentPlayerTurn();
  }

  function checkCurrentPlayerTurn() {
    const cur = getActivePlayer();
    if (!cur || !cur.alive) return;

    const isLocalMulti = BOMB_STATE.mode === 'LOCAL2' || BOMB_STATE.mode === 'LOCAL4';

    if (isLocalMulti && !cur.isAi) {
      // 本地同屏换人交接，弹出防窥保护幕布
      showTurnShield(cur);
    } else if (cur.isAi) {
      // AI 思考并行动
      scheduleAiTurn(cur);
    }
  }

  function showTurnShield(player) {
    const shield = document.getElementById('turn-shield');
    const textEl = document.getElementById('shield-player-text');
    if (shield && textEl) {
      textEl.textContent = `请其他玩家闭眼回避，轮到【${player.name}】行动！`;
      shield.classList.add('open');
    }
  }

  window.dismissTurnShield = function() {
    const shield = document.getElementById('turn-shield');
    if (shield) shield.classList.remove('open');
    BOMB_STATE.handRevealed = true; // 行动者接手，正面展开本人手牌
    renderHand();
    if (window.AUDIO) window.AUDIO.play('click');
  };

  // ==========================================================================
  // 核心交互：出牌 (Play Card)
  // ==========================================================================

  window.handleCardClick = function(idx) {
    const cur = getActivePlayer();
    if (!cur || cur.isAi || BOMB_STATE.phase !== 'PLAYING') return;

    const cardId = cur.hand[idx];
    if (!cardId) return;

    if (cardId === 'BOMB') {
      if (window.showToast) window.showToast('⚠️ 炸弹猫不可主动打出！', 2000);
      return;
    }
    if (cardId === 'DEFUSE') {
      if (window.showToast) window.showToast('💡 拆弹卡是保命被动牌，摸到炸弹时将自动救命！', 2000);
      return;
    }

    // 打出该功能牌
    executeCardAction(cur, idx);
  };

  function executeCardAction(player, handIdx) {
    const cardId = player.hand.splice(handIdx, 1)[0];
    BOMB_STATE.discardPile.push(cardId);
    BOMB_STATE.selectedCardIdx = -1;

    const def = CARD_DEFS[cardId];
    setStatusMessage(`✨ ${player.name} 打出了【${def.name}】！`);

    if (cardId === 'FUTURE') {
      if (window.AUDIO) window.AUDIO.play('reveal');
      handleSeeTheFuture(player);
    } else if (cardId === 'SKIP') {
      if (window.AUDIO) window.AUDIO.play('slash');
      if (window.showToast) window.showToast(`💨 ${player.name} 打出【甩锅跳过】，免去摸牌直接交棒！`, 2000);
      advanceTurn();
    } else if (cardId === 'ATTACK') {
      if (window.AUDIO) window.AUDIO.play('shot');
      if (window.showToast) window.showToast(`⚡ ${player.name} 发动【连击打击】，强迫下家连续行动 2 回合！`, 2200);
      // 结束当前玩家回合，并将下家惩罚设为 1 (连动2回合)
      handleAttackAction();
    } else if (cardId === 'SHUFFLE') {
      if (window.AUDIO) window.AUDIO.play('dice_shake');
      shuffleArray(BOMB_STATE.deck);
      BOMB_STATE.knownTopCards = null;
      if (window.showToast) window.showToast(`🌪️ 命运洗牌！${player.name} 打乱了公共牌堆顺序！`, 2000);
      updateUI();
    } else if (cardId === 'STEAL') {
      if (window.AUDIO) window.AUDIO.play('card_draw');
      handleStealCard(player);
    }

    updateUI();

    // AI 出完非结回合功能牌 (预知/洗牌/偷窃) 后继续推进当前回合决策
    if (player.isAi && cardId !== 'SKIP' && cardId !== 'ATTACK') {
      if (BOMB_STATE.turnTimer) clearTimeout(BOMB_STATE.turnTimer);
      BOMB_STATE.turnTimer = setTimeout(() => {
        if (BOMB_STATE.phase === 'PLAYING' && getActivePlayer() === player && player.alive) {
          scheduleAiTurn(player);
        }
      }, 750);
    }
  }

  function handleAttackAction() {
    const n = BOMB_STATE.players.length;
    let nextIdx = (BOMB_STATE.turnIndex + 1) % n;
    while (!BOMB_STATE.players[nextIdx].alive) {
      nextIdx = (nextIdx + 1) % n;
    }

    const currentPending = BOMB_STATE.extraTurns;
    const totalTurnsForNext = (currentPending > 0 ? currentPending : 0) + 2;
    BOMB_STATE.turnIndex = nextIdx;
    BOMB_STATE.extraTurns = totalTurnsForNext - 1; // extraTurns 表示当前回合之后的额外回合数
    BOMB_STATE.handRevealed = false;
    BOMB_STATE.antiPeekHeld = false;
    updateUI();
    checkCurrentPlayerTurn();
  }

  function handleSeeTheFuture(player) {
    const top3 = BOMB_STATE.deck.slice(0, 3);
    BOMB_STATE.knownTopCards = top3;

    if (!player.isAi) {
      const modal = document.getElementById('modal-future');
      const row = document.getElementById('future-cards-row');
      if (modal && row) {
        row.innerHTML = '';
        top3.forEach((cid, i) => {
          const cardDef = CARD_DEFS[cid];
          const cEl = document.createElement('div');
          cEl.className = `v-card ${cardDef.cssClass}`;
          cEl.innerHTML = `
            <div class="card-inner">
              <span class="card-corner">#${i + 1}</span>
              <div class="card-center-icon">${cardDef.icon}</div>
              <span class="card-name-label">${cardDef.name}</span>
            </div>
          `;
          row.appendChild(cEl);
        });
        modal.classList.add('open');
      }
    }
  }

  window.closeFutureModal = function() {
    const modal = document.getElementById('modal-future');
    if (modal) modal.classList.remove('open');
    if (window.AUDIO) window.AUDIO.play('click');
  };

  function handleStealCard(player) {
    const validTargets = BOMB_STATE.players.filter(p => p.alive && p.id !== player.id && p.hand.length > 0);
    if (validTargets.length === 0) {
      if (window.showToast) window.showToast('🐱 场上对手均无手牌可偷！', 2000);
      return;
    }

    if (validTargets.length === 1 && !player.isAi) {
      executeStealFrom(player, validTargets[0]);
      return;
    }

    if (!player.isAi) {
      const modal = document.getElementById('modal-steal');
      const list = document.getElementById('steal-targets-list');
      if (modal && list) {
        list.innerHTML = '';
        validTargets.forEach(tgt => {
          const btn = document.createElement('button');
          btn.className = 'stealth-opt-btn';
          btn.innerHTML = `<span>${tgt.name}</span><span style="color:#fbbf24;">持有 ${tgt.hand.length} 张牌</span>`;
          btn.onclick = () => {
            executeStealFrom(player, tgt);
            modal.classList.remove('open');
          };
          list.appendChild(btn);
        });
        modal.classList.add('open');
      }
    } else {
      // AI 随机选取手牌最多的对手
      validTargets.sort((a, b) => b.hand.length - a.hand.length);
      const chosen = validTargets[0];
      executeStealFrom(player, chosen);
    }
  }

  function executeStealFrom(thief, victim) {
    if (victim.hand.length === 0) return;
    const rIdx = Math.floor(Math.random() * victim.hand.length);
    const stolenCard = victim.hand.splice(rIdx, 1)[0];
    thief.hand.push(stolenCard);

    if (window.AUDIO) window.AUDIO.play('card_draw');
    const msg = `🐱 ${thief.name} 从 ${victim.name} 手中顺手牵羊摸走了 1 张牌！`;
    setStatusMessage(msg);
    if (window.showToast) window.showToast(msg, 2400);

    updateUI();
  }

  // ==========================================================================
  // 核心交互：摸牌与炸弹结算 (Draw Card & Defuse Engine)
  // ==========================================================================

  window.handleDeckClick = function() {
    const shield = document.getElementById('turn-shield');
    if (shield && shield.classList.contains('open')) return;

    const cur = getActivePlayer();
    if (!cur || cur.isAi || BOMB_STATE.phase !== 'PLAYING') return;

    executeDrawCard(cur);
  };

  function executeDrawCard(player) {
    if (BOMB_STATE.deck.length === 0) {
      if (window.showToast) window.showToast('公共牌堆已摸空，游戏和平结束！', 2500);
      return;
    }

    const drawnCard = BOMB_STATE.deck.shift();

    if (drawnCard !== 'BOMB') {
      // 安全摸得普通牌
      player.hand.push(drawnCard);
      if (window.AUDIO) window.AUDIO.play('card_draw');
      const def = CARD_DEFS[drawnCard];
      const msg = `🎴 ${player.name} 安全摸得一张【${def.name}】！`;
      setStatusMessage(msg);
      if (window.showToast) window.showToast(msg, 1800);

      advanceTurn();
    } else {
      // 摸到【💣 炸弹猫】！
      handleBombDrawn(player);
    }
  }

  function handleBombDrawn(player) {
    if (window.AUDIO) window.AUDIO.play('bomb_alarm');
    setStatusMessage(`🚨 警报拉响！${player.name} 摸到了【💣 炸弹猫】！！`);

    const defuseIdx = player.hand.indexOf('DEFUSE');

    if (defuseIdx !== -1) {
      // 拥有【拆弹卡】自救！
      player.hand.splice(defuseIdx, 1);
      BOMB_STATE.discardPile.push('DEFUSE');
      updateUI(); // 立即同步手牌与拆弹数量指示

      if (window.AUDIO) window.AUDIO.play('cat_meow');

      if (!player.isAi) {
        // 玩家秘密自选埋雷深度
        BOMB_STATE.pendingBombPlayer = player;
        BOMB_STATE.phase = 'DEFUSE_INSERT';
        const modal = document.getElementById('modal-defuse-insert');
        if (modal) modal.classList.add('open');
      } else {
        // AI 拆弹并智能插回牌堆顶或浅层暗算对手
        aiExecuteDefuseInsert(player);
      }
    } else {
      // 无拆弹卡，当场自爆淘汰！
      handlePlayerExplode(player);
    }
  }

  window.executeDefuseInsert = function(depthChoice) {
    const modal = document.getElementById('modal-defuse-insert');
    if (modal) modal.classList.remove('open');

    insertBombIntoDeck(depthChoice);
    BOMB_STATE.phase = 'PLAYING';
    BOMB_STATE.pendingBombPlayer = null;

    if (window.showToast) window.showToast('🧯 拆弹成功！炸弹猫已秘密埋入牌堆深处！', 2200);
    advanceTurn();
  };

  function insertBombIntoDeck(choice) {
    const len = BOMB_STATE.deck.length;
    if (choice === 'TOP' || len === 0) {
      BOMB_STATE.deck.unshift('BOMB');
    } else if (choice === 'NEAR_TOP') {
      const idx = Math.min(len, Math.floor(Math.random() * 2) + 1);
      BOMB_STATE.deck.splice(idx, 0, 'BOMB');
    } else if (choice === 'MIDDLE') {
      const idx = Math.floor(len / 2);
      BOMB_STATE.deck.splice(idx, 0, 'BOMB');
    } else if (choice === 'BOTTOM') {
      BOMB_STATE.deck.push('BOMB');
    } else {
      // RANDOM
      const idx = Math.floor(Math.random() * (len + 1));
      BOMB_STATE.deck.splice(idx, 0, 'BOMB');
    }
    BOMB_STATE.knownTopCards = null;
  }

  function aiExecuteDefuseInsert(ai) {
    // AI 决策：65% 概率插在最顶层 (第1张) 陷害下家，20% 插在第2张，15% 随机
    const r = Math.random();
    let choice = 'TOP';
    if (r < 0.65) choice = 'TOP';
    else if (r < 0.85) choice = 'NEAR_TOP';
    else choice = 'RANDOM';

    insertBombIntoDeck(choice);
    const msg = `🧯 ${ai.name} 紧急打出【拆弹卡】自救成功，并悄悄将炸弹塞回了牌堆！`;
    setStatusMessage(msg);
    if (window.showToast) window.showToast(msg, 2400);

    if (BOMB_STATE.turnTimer) clearTimeout(BOMB_STATE.turnTimer);
    BOMB_STATE.turnTimer = setTimeout(() => {
      advanceTurn();
    }, 1000);
  }

  function handlePlayerExplode(player) {
    player.alive = false;
    BOMB_STATE.extraTurns = 0; // 淘汰出局清空该玩家连击负荷
    // 丢弃全部手牌至弃牌堆
    while (player.hand.length > 0) {
      BOMB_STATE.discardPile.push(player.hand.pop());
    }

    if (window.AUDIO) {
      window.AUDIO.play('contra_explode');
    }

    const msg = `💥 轰！！！${player.name} 无力拆弹，被炸弹猫淘汰出局！`;
    setStatusMessage(msg);
    if (window.showToast) window.showToast(msg, 2600);

    updateUI();

    // 检查剩余存活者
    const alivePlayers = BOMB_STATE.players.filter(p => p.alive);
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      BOMB_STATE.phase = 'GAME_OVER';
      if (window.AUDIO) window.AUDIO.play('win');

      if (BOMB_STATE.roundTimer) clearTimeout(BOMB_STATE.roundTimer);
      BOMB_STATE.roundTimer = setTimeout(() => {
        if (window.showModal) {
          window.showModal(
            '🏆 拆弹猫幸存总冠军！',
            `
              <p style="font-size:1.05rem; margin-bottom:12px;">🎉 恭喜 <strong style="color:#fbbf24;">${winner.name}</strong> 运筹帷幄，在炸弹猫的洗礼中成为唯一幸存者！</p>
              <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:10px 16px;">
                <p style="font-size:0.85rem; color:#94a3b8;">剩余摸牌堆尚余: <b>${BOMB_STATE.deck.length}</b> 张牌</p>
                <p style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">弃牌堆共计消耗: <b>${BOMB_STATE.discardPile.length}</b> 张牌</p>
              </div>
            `,
            { isGameOver: true }
          );
        }
      }, 800);
    } else {
      if (BOMB_STATE.turnTimer) clearTimeout(BOMB_STATE.turnTimer);
      BOMB_STATE.turnTimer = setTimeout(() => {
        advanceTurn();
      }, 1200);
    }
  }

  // ==========================================================================
  // 智能 AI 决策模型 (AI Heuristics)
  // ==========================================================================

  function scheduleAiTurn(ai) {
    if (BOMB_STATE.aiTimer) clearTimeout(BOMB_STATE.aiTimer);

    BOMB_STATE.aiTimer = setTimeout(() => {
      if (BOMB_STATE.phase !== 'PLAYING') return;

      const deckLen = BOMB_STATE.deck.length;
      const bombsRemaining = BOMB_STATE.deck.filter(c => c === 'BOMB').length;
      const bombProb = deckLen > 0 ? (bombsRemaining / deckLen) : 0;

      // 1. 如果 AI 之前预知且明确知道顶牌是炸弹，必须坚决避险！
      const knowTopIsBomb = BOMB_STATE.knownTopCards && BOMB_STATE.knownTopCards[0] === 'BOMB';

      const skipIdx = ai.hand.indexOf('SKIP');
      const attackIdx = ai.hand.indexOf('ATTACK');
      const shuffleIdx = ai.hand.indexOf('SHUFFLE');
      const futureIdx = ai.hand.indexOf('FUTURE');
      const stealIdx = ai.hand.indexOf('STEAL');

      if (knowTopIsBomb) {
        if (skipIdx !== -1) { executeCardAction(ai, skipIdx); return; }
        if (attackIdx !== -1) { executeCardAction(ai, attackIdx); return; }
        if (shuffleIdx !== -1) { executeCardAction(ai, shuffleIdx); return; }
        if (stealIdx !== -1) { executeCardAction(ai, stealIdx); return; }
      }

      // 2. 危险概率高且 AI 无拆弹卡时，优先开预知或甩锅
      const hasDefuse = ai.hand.includes('DEFUSE');
      if (bombProb > 0.35 && !hasDefuse) {
        if (futureIdx !== -1) { executeCardAction(ai, futureIdx); return; }
        if (skipIdx !== -1) { executeCardAction(ai, skipIdx); return; }
        if (attackIdx !== -1) { executeCardAction(ai, attackIdx); return; }
      }

      // 3. 有一定概率打出顺手牵羊抢占优势
      if (stealIdx !== -1 && Math.random() < 0.45) {
        executeCardAction(ai, stealIdx);
        return;
      }

      // 4. 执行摸牌
      executeDrawCard(ai);
    }, 900);
  }

  // ==========================================================================
  // 手牌防偷窥 (Hold to View / Pass-and-Play)
  // ==========================================================================

  function setupAntiPeekGestures() {
    const btn = document.getElementById('btn-peek-hold');
    if (!btn) return;

    const setPeek = (isPeek) => {
      BOMB_STATE.antiPeekHeld = isPeek;
      btn.classList.toggle('active', isPeek);
      btn.textContent = isPeek ? '👁️ 手牌展开中' : '👁️ 按住显牌';
      renderHand();
    };

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        if (btn.setPointerCapture && e.pointerId !== undefined) {
          btn.setPointerCapture(e.pointerId);
        }
      } catch(err) {}
      setPeek(true);
    });
    btn.addEventListener('pointerup', (e) => {
      try {
        if (btn.releasePointerCapture && e.pointerId !== undefined) {
          btn.releasePointerCapture(e.pointerId);
        }
      } catch(err) {}
      if (BOMB_STATE.antiPeekHeld) setPeek(false);
    });
    btn.addEventListener('pointercancel', (e) => {
      try {
        if (btn.releasePointerCapture && e.pointerId !== undefined) {
          btn.releasePointerCapture(e.pointerId);
        }
      } catch(err) {}
      if (BOMB_STATE.antiPeekHeld) setPeek(false);
    });

    // 点击切换显隐 (对 PC 鼠标操作友好)
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isLocalMulti = BOMB_STATE.mode === 'LOCAL2' || BOMB_STATE.mode === 'LOCAL4';
      if (isLocalMulti) {
        BOMB_STATE.handRevealed = !BOMB_STATE.handRevealed;
        btn.textContent = BOMB_STATE.handRevealed ? '🕶️ 遮蔽手牌' : '👁️ 展开手牌';
        renderHand();
      }
    });
  }

  // ==========================================================================
  // UI 渲染与视图绑定
  // ==========================================================================

  function setStatusMessage(msg) {
    const el = document.getElementById('status-message');
    if (el) el.textContent = msg;
  }

  function updateUI() {
    // 1. 席位卡片与状态
    BOMB_STATE.players.forEach(p => {
      const seat = document.getElementById(`seat-p${p.id}`);
      const nameEl = document.getElementById(`name-p${p.id}`);
      const countEl = document.getElementById(`count-p${p.id}`);
      const defuseEl = document.getElementById(`defuse-p${p.id}`);

      if (seat) {
        seat.style.display = 'flex';
        seat.classList.toggle('active-turn', p.id === (BOMB_STATE.turnIndex + 1));
        seat.classList.toggle('dead', !p.alive);
      }
      if (nameEl) {
        nameEl.textContent = p.name + (p.isAi ? ' 🤖' : '');
      }
      if (countEl) {
        countEl.textContent = p.alive ? p.hand.length : '💀';
      }
      if (defuseEl) {
        const dCount = p.hand.filter(c => c === 'DEFUSE').length;
        defuseEl.className = 'seat-defuse-pill' + (dCount === 0 ? ' none' : '');
        defuseEl.textContent = `🧯 拆弹 x${dCount}`;
      }
    });

    // 隐藏多余席位
    for (let i = BOMB_STATE.players.length + 1; i <= 4; i++) {
      const seat = document.getElementById(`seat-p${i}`);
      if (seat) seat.style.display = 'none';
    }

    // 2. 牌堆与弃牌堆指示
    const deckCountEl = document.getElementById('deck-count');
    if (deckCountEl) deckCountEl.textContent = BOMB_STATE.deck.length;

    const discardLast = document.getElementById('discard-last-card');
    if (discardLast) {
      if (BOMB_STATE.discardPile.length > 0) {
        const topDiscard = BOMB_STATE.discardPile[BOMB_STATE.discardPile.length - 1];
        const def = CARD_DEFS[topDiscard];
        discardLast.className = `discard-last-card ${def.cssClass}`;
        discardLast.innerHTML = `
          <div class="card-inner">
            <span class="card-corner">${def.en}</span>
            <div class="card-center-icon">${def.icon}</div>
            <span class="card-name-label">${def.name}</span>
          </div>
        `;
      } else {
        discardLast.className = 'discard-last-card';
        discardLast.innerHTML = `<span style="font-size:1.8rem; color:#64748b;">🎴</span><span style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">空</span>`;
      }
    }

    // 3. 连击指示
    const turnsPill = document.getElementById('status-turns-pill');
    if (turnsPill) {
      if (BOMB_STATE.extraTurns > 0) {
        turnsPill.style.display = 'inline-block';
        turnsPill.textContent = `⚡ 需连动 ${BOMB_STATE.extraTurns + 1} 回合`;
      } else {
        turnsPill.style.display = 'none';
      }
    }

    // 4. 渲染手牌
    renderHand();
  }

  function renderHand() {
    const activeP = getActivePlayer();
    const track = document.getElementById('hand-track');
    const totalEl = document.getElementById('hand-cards-total');
    const titleEl = document.querySelector('.hand-title');
    if (!track) return;

    const isLocalMulti = BOMB_STATE.mode === 'LOCAL2' || BOMB_STATE.mode === 'LOCAL4';
    // 在单人人机模式下，手牌底栏始终展示人类玩家 P1 的手牌；本地同屏模式下展示当前行动者
    const targetPlayer = isLocalMulti ? activeP : BOMB_STATE.players[0];

    if (!targetPlayer) {
      track.innerHTML = '';
      return;
    }

    if (totalEl) totalEl.textContent = `(${targetPlayer.hand.length} 张)`;

    const isCurrentTurn = targetPlayer === activeP && targetPlayer.alive && BOMB_STATE.phase === 'PLAYING';

    if (titleEl) {
      if (isLocalMulti) {
        titleEl.innerHTML = `<span>🗂️ ${targetPlayer.name} 的手牌</span> <span style="font-size:0.72rem; color:#94a3b8;" id="hand-cards-total">(${targetPlayer.hand.length} 张)</span>`;
      } else {
        const waitText = isCurrentTurn ? '' : ' <span style="font-size:0.75rem; color:#f59e0b; margin-left:8px;">⏳ (等待电脑行动...)</span>';
        titleEl.innerHTML = `<span>🗂️ 我的手牌</span> <span style="font-size:0.72rem; color:#94a3b8;" id="hand-cards-total">(${targetPlayer.hand.length} 张)</span>${waitText}`;
      }
    }

    // 单人模式默认显牌；本地同屏多人在松手且未准备出牌时保持暗牌防偷窥
    const showFace = (!isLocalMulti) || BOMB_STATE.antiPeekHeld || BOMB_STATE.handRevealed;

    track.innerHTML = '';

    targetPlayer.hand.forEach((cid, idx) => {
      const def = CARD_DEFS[cid];
      const cardEl = document.createElement('div');
      cardEl.className = `v-card ${showFace ? def.cssClass : 'face-down'}`;

      if (!isCurrentTurn) {
        cardEl.style.opacity = '0.72';
        cardEl.style.cursor = 'not-allowed';
      }

      if (showFace) {
        cardEl.innerHTML = `
          <div class="card-inner">
            <span class="card-corner">${def.en}</span>
            <div class="card-center-icon">${def.icon}</div>
            <span class="card-name-label">${def.name}</span>
            <span class="card-desc-label">${def.desc}</span>
          </div>
        `;
        if (isCurrentTurn && !targetPlayer.isAi) {
          cardEl.onclick = () => window.handleCardClick(idx);
        }
      } else {
        cardEl.innerHTML = `
          <div class="card-back-pattern">
            <span>🐾</span>
          </div>
        `;
      }

      track.appendChild(cardEl);
    });
  }

  // ==========================================================================
  // 模式切换与重置
  // ==========================================================================

  window.switchBombCatMode = function(mode) {
    BOMB_STATE.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tab-${mode.toLowerCase()}`);
    if (tab) tab.classList.add('active');

    resetCurrentGame();
  };

  function resetCurrentGame() {
    ['modal-defuse-insert', 'modal-future', 'modal-steal', 'turn-shield'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });
    initPlayers();
    setupNewDeck();
    updateUI();
    setStatusMessage(`🎮 游戏已重置，轮到 ${getActivePlayer().name} 行动！`);
    checkCurrentPlayerTurn();
  }

  // ==========================================================================
  // 初始化与说明接入
  // ==========================================================================

  window.addEventListener('DOMContentLoaded', () => {
    setupAntiPeekGestures();
    initPlayers();
    setupNewDeck();
    updateUI();

    if (window.initCommonHeader) {
      window.initCommonHeader(
        "💣 疯狂拆弹猫 (Bomb Cat) 规则与指南",
        `
          <p><strong>经典博弈卡牌聚会神作：</strong>与好友或智能 AI 斗智斗勇，避免抽中潜伏的【炸弹猫】！</p><br>
          <p><strong>🎯 核心玩法链路：</strong></p>
          <ul>
            <li><b>出牌阶段 (可选)：</b>当前玩家可随意打出任意张功能牌（预知、跳过、攻击等）。</li>
            <li><b>摸牌阶段 (强制)：</b>点击公共牌堆摸 1 张牌，安全收入手牌则结束己方回合。</li>
          </ul><br>
          <p><strong>💣 炸弹猫与拆弹反杀：</strong></p>
          <ul>
            <li>一旦摸中【炸弹猫】，若手中持有【拆弹卡】将自动自救，并获得<b>“秘密埋雷”</b>特权：可将炸弹自由塞回牌堆指定深度（如塞在第1张暗算下家）！</li>
            <li>若手中无拆弹卡，当场自爆淘汰出局！</li>
          </ul><br>
          <p><strong>🗂️ 7 大精炼功能牌：</strong></p>
          <ul>
            <li><b>🔮 预知未来：</b>私密偷看牌堆顶部的 3 张牌。</li>
            <li><b>💨 甩锅跳过：</b>免去本次摸牌，直接结束回合甩给下家。</li>
            <li><b>⚡ 连击打击：</b>免去摸牌，强迫下一名玩家连续行动 2 回合。</li>
            <li><b>🌪️ 命运洗牌：</b>当场重新洗乱公共牌堆，破除别人埋下的必中暗雷。</li>
            <li><b>🐱 顺手牵羊：</b>盲抽一名存活对手的 1 张手牌。</li>
          </ul><br>
          <p><strong>🕶️ 本地同屏防偷看：</strong>长按 <b>【👁️ 按住显牌】</b> 可查看暗牌，松手自动隐蔽遮盖！</p>
        `,
        resetCurrentGame
      );
    }
  });

})();
