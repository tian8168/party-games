/**
 * 🌈 彩虹乌诺牌 (UNO Party 4P)
 * 108 张正统卡牌 · 双向流向状态机 · 连环叠牌反弹 · 喊 UNO 与抓漏举报 · 高阶 AI 决策
 */

(function() {
  'use strict';

  // ==========================================================================
  // 1. 卡牌常量与 108 张正统牌库定义
  // ==========================================================================
  const COLORS = {
    RED: { key: 'RED', name: '红', hex: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' },
    YELLOW: { key: 'YELLOW', name: '黄', hex: '#eab308', glow: 'rgba(234, 179, 8, 0.6)' },
    GREEN: { key: 'GREEN', name: '绿', hex: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)' },
    BLUE: { key: 'BLUE', name: '蓝', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' },
    WILD: { key: 'WILD', name: '万能', hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.7)' }
  };

  const CARD_TYPES = {
    NUMBER: 'NUMBER',
    SKIP: 'SKIP',
    REVERSE: 'REVERSE',
    DRAW2: 'DRAW2',
    WILD: 'WILD',
    WILD_DRAW4: 'WILD_DRAW4'
  };

  // 108 张卡牌配比构建
  function buildUnoDeck() {
    const deck = [];
    let idCounter = 1;
    const baseColors = ['RED', 'YELLOW', 'GREEN', 'BLUE'];

    baseColors.forEach(colorKey => {
      // 0 号牌每色 1 张
      deck.push({
        id: `c_${idCounter++}`,
        color: colorKey,
        type: CARD_TYPES.NUMBER,
        value: 0,
        score: 0,
        label: '0'
      });

      // 1 ~ 9 号牌每色各 2 张
      for (let num = 1; num <= 9; num++) {
        for (let copy = 0; copy < 2; copy++) {
          deck.push({
            id: `c_${idCounter++}`,
            color: colorKey,
            type: CARD_TYPES.NUMBER,
            value: num,
            score: num,
            label: `${num}`
          });
        }
      }

      // 功能牌 (Skip, Reverse, Draw2) 每色各 2 张
      for (let copy = 0; copy < 2; copy++) {
        deck.push({
          id: `c_${idCounter++}`,
          color: colorKey,
          type: CARD_TYPES.SKIP,
          value: 'SKIP',
          score: 20,
          label: '🚫'
        });
        deck.push({
          id: `c_${idCounter++}`,
          color: colorKey,
          type: CARD_TYPES.REVERSE,
          value: 'REVERSE',
          score: 20,
          label: '🔄'
        });
        deck.push({
          id: `c_${idCounter++}`,
          color: colorKey,
          type: CARD_TYPES.DRAW2,
          value: 'DRAW2',
          score: 20,
          label: '+2'
        });
      }
    });

    // 黑色万能牌各 4 张 (共 8 张)
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: `c_${idCounter++}`,
        color: 'WILD',
        type: CARD_TYPES.WILD,
        value: 'WILD',
        score: 50,
        label: '🌈'
      });
      deck.push({
        id: `c_${idCounter++}`,
        color: 'WILD',
        type: CARD_TYPES.WILD_DRAW4,
        value: 'WILD_DRAW4',
        score: 50,
        label: '+4'
      });
    }

    return deck;
  }

  // Fisher-Yates 洗牌算法
  function shuffle(arr) {
    const list = [...arr];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // ==========================================================================
  // 2. 游戏全局状态机 (UNO GAME STATE)
  // ==========================================================================
  const UNO_STATE = {
    mode: 'AI3', // 'AI3' (1人vs3AI), 'AI1' (1v1), 'LOCAL2' (双人同屏), 'LOCAL4' (4人同屏)
    players: [],
    turnIndex: 0,
    direction: 1, // 1: 顺时针, -1: 逆时针
    deck: [],
    discardPile: [],
    currentCard: null,
    currentColor: 'RED',
    stackPenalty: 0, // 累积罚抽张数 (叠牌模式)
    stackCardType: null, // 'DRAW2' 或 'WILD_DRAW4'
    houseRules: {
      stacking: true, // 允许 +2 叠加反弹
      drawToMatch: false // 摸到能出为止 (默认摸1张)
    },
    phase: 'IDLE', // 'IDLE', 'PLAYING', 'COLOR_PICKER', 'ROUND_OVER', 'GAME_OVER'
    unoDangerPlayerId: null, // 仅剩1张牌待喊UNO的玩家
    unoCallTimer: null,
    unoPenaltyCaught: false,
    antiPeekHeld: false,
    aiTimer: null,
    targetScore: 250,
    matchWinner: null,
    roundNumber: 1,
    actionLog: []
  };

  // ==========================================================================
  // 3. 游戏初始化与发牌
  // ==========================================================================
  function initPlayers() {
    let configs = [];
    if (UNO_STATE.mode === 'AI1') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (你)', isAi: false, colorClass: 'seat-p1' },
        { id: 2, name: '🟢 智子 2 (AI)', isAi: true, colorClass: 'seat-p2' }
      ];
    } else if (UNO_STATE.mode === 'AI3') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (你)', isAi: false, colorClass: 'seat-p1' },
        { id: 2, name: '🟢 智子 2 (AI)', isAi: true, colorClass: 'seat-p2' },
        { id: 3, name: '🔵 智子 3 (AI)', isAi: true, colorClass: 'seat-p3' },
        { id: 4, name: '🟡 智子 4 (AI)', isAi: true, colorClass: 'seat-p4' }
      ];
    } else if (UNO_STATE.mode === 'LOCAL2') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (红)', isAi: false, colorClass: 'seat-p1' },
        { id: 2, name: '🟢 玩家 2 (绿)', isAi: false, colorClass: 'seat-p2' }
      ];
    } else if (UNO_STATE.mode === 'LOCAL4') {
      configs = [
        { id: 1, name: '🔴 玩家 1 (红)', isAi: false, colorClass: 'seat-p1' },
        { id: 2, name: '🟢 玩家 2 (绿)', isAi: false, colorClass: 'seat-p2' },
        { id: 3, name: '🔵 玩家 3 (蓝)', isAi: false, colorClass: 'seat-p3' },
        { id: 4, name: '🟡 玩家 4 (黄)', isAi: false, colorClass: 'seat-p4' }
      ];
    }

    UNO_STATE.players = configs.map(c => ({
      id: c.id,
      name: c.name,
      isAi: c.isAi,
      colorClass: c.colorClass,
      hand: [],
      score: 0,
      calledUno: false
    }));
  }

  function startUnoGame(resetScores = false) {
    if (resetScores) {
      UNO_STATE.roundNumber = 1;
      UNO_STATE.matchWinner = null;
      initPlayers();
    }

    // 重置牌堆
    const fullDeck = shuffle(buildUnoDeck());
    UNO_STATE.deck = fullDeck;
    UNO_STATE.discardPile = [];
    UNO_STATE.direction = 1;
    UNO_STATE.turnIndex = 0;
    UNO_STATE.stackPenalty = 0;
    UNO_STATE.stackCardType = null;
    UNO_STATE.phase = 'PLAYING';
    UNO_STATE.unoDangerPlayerId = null;
    UNO_STATE.unoPenaltyCaught = false;
    UNO_STATE.antiPeekHeld = false;
    clearTimeout(UNO_STATE.aiTimer);
    clearTimeout(UNO_STATE.unoCallTimer);

    // 每人发 7 张牌
    UNO_STATE.players.forEach(p => {
      p.hand = UNO_STATE.deck.splice(0, 7);
      p.calledUno = false;
    });

    // 翻出第一张非 Wild+4 底牌
    let firstCard = UNO_STATE.deck.shift();
    while (firstCard.type === CARD_TYPES.WILD_DRAW4) {
      UNO_STATE.deck.push(firstCard);
      UNO_STATE.deck = shuffle(UNO_STATE.deck);
      firstCard = UNO_STATE.deck.shift();
    }

    UNO_STATE.discardPile.push(firstCard);
    UNO_STATE.currentCard = firstCard;
    UNO_STATE.currentColor = firstCard.color === 'WILD' ? 'RED' : firstCard.color;

    // 解析开局第一张牌的特殊效果
    resolveOpeningCard(firstCard);

    appendLog(`🏁 第 ${UNO_STATE.roundNumber} 局开始！底牌为 [${COLORS[UNO_STATE.currentColor].name} ${firstCard.label}]`);
    updateUI();

    // 启动先手回合
    checkNextTurn();
  }

  function resolveOpeningCard(card) {
    if (card.type === CARD_TYPES.SKIP) {
      UNO_STATE.turnIndex = getNextPlayerIndex();
      appendLog(`🚫 开局翻出跳过牌，首家被跳过！`);
    } else if (card.type === CARD_TYPES.REVERSE) {
      UNO_STATE.direction = -1;
      appendLog(`🔄 开局翻出反转牌，转为逆时针方向！`);
    } else if (card.type === CARD_TYPES.DRAW2) {
      UNO_STATE.stackPenalty = 2;
      UNO_STATE.stackCardType = CARD_TYPES.DRAW2;
      appendLog(`⚡ 开局翻出 +2，首家面临罚抽两张！`);
    }
  }

  // ==========================================================================
  // 4. 出牌校验与规则逻辑
  // ==========================================================================
  function canPlayCard(card, player) {
    if (!card) return false;

    // 1. 如果当前存在待处理的 +2 或 +4 连环叠牌惩罚
    if (UNO_STATE.stackPenalty > 0) {
      if (UNO_STATE.houseRules.stacking) {
        // 允许同类型叠加 (DRAW2 叠 DRAW2，WILD_DRAW4 叠 WILD_DRAW4)
        if (UNO_STATE.stackCardType === CARD_TYPES.DRAW2 && card.type === CARD_TYPES.DRAW2) return true;
        if (UNO_STATE.stackCardType === CARD_TYPES.WILD_DRAW4 && card.type === CARD_TYPES.WILD_DRAW4) return true;
      }
      return false; // 无法叠牌则必须摸牌受罚
    }

    // 2. 万能牌随时可出
    if (card.color === 'WILD') return true;

    // 3. 颜色相符
    if (card.color === UNO_STATE.currentColor) return true;

    // 4. 数值或符号相符
    if (card.type === UNO_STATE.currentCard.type && card.value === UNO_STATE.currentCard.value) return true;

    return false;
  }

  function getPlayableCards(player) {
    return player.hand.filter(card => canPlayCard(card, player));
  }

  function playCard(player, cardIndex, chosenColor = null) {
    if (UNO_STATE.phase !== 'PLAYING') return;

    const card = player.hand[cardIndex];
    if (!canPlayCard(card, player)) return;

    // 从手牌移至弃牌堆
    player.hand.splice(cardIndex, 1);
    UNO_STATE.discardPile.push(card);
    UNO_STATE.currentCard = card;

    // 音效
    if (window.AUDIO) AUDIO.play('uno_play');

    appendLog(`${player.name} 打出了 [${COLORS[card.color === 'WILD' ? (chosenColor || 'WILD') : card.color].name} ${card.label}]`);

    // 处理 UNO 喊叫机制：如果出牌后只剩 1 张牌
    if (player.hand.length === 1) {
      triggerUnoDangerWindow(player);
    } else {
      player.calledUno = false;
    }

    // 胜局检查：若手牌已打空
    if (player.hand.length === 0) {
      handleRoundVictory(player);
      return;
    }

    // 处理功能效果
    if (card.color === 'WILD') {
      if (!chosenColor) {
        if (!player.isAi) {
          // 人类玩家弹出四色选择转盘
          UNO_STATE.phase = 'COLOR_PICKER';
          openColorPickerModal(card);
          return;
        } else {
          chosenColor = aiPickDominantColor(player);
        }
      }
      UNO_STATE.currentColor = chosenColor;
      if (window.AUDIO) AUDIO.play('uno_wild');
      appendLog(`🌈 选色生效：当前颜色变更为 【${COLORS[chosenColor].name}色】！`);

      if (card.type === CARD_TYPES.WILD_DRAW4) {
        UNO_STATE.stackPenalty += 4;
        UNO_STATE.stackCardType = CARD_TYPES.WILD_DRAW4;
        if (window.AUDIO) AUDIO.play('uno_strike');
        appendLog(`💣 王牌 +4 发动！下家面临罚抽 ${UNO_STATE.stackPenalty} 张！`);
      }
    } else {
      UNO_STATE.currentColor = card.color;

      if (card.type === CARD_TYPES.SKIP) {
        if (window.AUDIO) AUDIO.play('uno_skip');
        advanceTurn(true); // 跳过下家
        return;
      } else if (card.type === CARD_TYPES.REVERSE) {
        if (window.AUDIO) AUDIO.play('uno_reverse');
        if (UNO_STATE.players.length === 2) {
          // 双人局 Reverse 等同于 Skip
          advanceTurn(true);
          appendLog(`🔄 双人对决：反转牌直接跳过对手！`);
          return;
        } else {
          UNO_STATE.direction = -UNO_STATE.direction;
          appendLog(`🔄 逆转时空！流向变为 【${UNO_STATE.direction === 1 ? '顺时针' : '逆时针'}】！`);
        }
      } else if (card.type === CARD_TYPES.DRAW2) {
        UNO_STATE.stackPenalty += 2;
        UNO_STATE.stackCardType = CARD_TYPES.DRAW2;
        if (window.AUDIO) AUDIO.play('uno_strike');
        appendLog(`⚡ 罚抽 +2 发动！下家面临罚抽 ${UNO_STATE.stackPenalty} 张！`);
      }
    }

    advanceTurn(false);
  }

  function advanceTurn(skipNext = false) {
    let steps = skipNext ? 2 : 1;
    UNO_STATE.turnIndex = getNextPlayerIndex(steps);
    updateUI();
    checkNextTurn();
  }

  function getNextPlayerIndex(steps = 1) {
    const total = UNO_STATE.players.length;
    let next = (UNO_STATE.turnIndex + steps * UNO_STATE.direction) % total;
    if (next < 0) next += total;
    return next;
  }

  // ==========================================================================
  // 5. 摸牌与受罚惩罚逻辑
  // ==========================================================================
  function drawCardsFromDeck(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (UNO_STATE.deck.length === 0) {
        recycleDiscardPile();
      }
      if (UNO_STATE.deck.length > 0) {
        drawn.push(UNO_STATE.deck.shift());
      }
    }
    return drawn;
  }

  function recycleDiscardPile() {
    if (UNO_STATE.discardPile.length <= 1) return;
    const top = UNO_STATE.discardPile.pop();
    UNO_STATE.deck = shuffle(UNO_STATE.discardPile);
    UNO_STATE.discardPile = [top];
    appendLog(`♻️ 公共牌堆耗尽，弃牌堆已重新充分洗匀！`);
  }

  function handleDrawButton() {
    const activePlayer = UNO_STATE.players[UNO_STATE.turnIndex];
    if (activePlayer.isAi || UNO_STATE.phase !== 'PLAYING') return;

    playerDrawTurn(activePlayer);
  }

  function playerDrawTurn(player) {
    // 1. 如果当前存在 +2/+4 叠牌惩罚，且玩家无法出牌接招
    if (UNO_STATE.stackPenalty > 0) {
      const penaltyCount = UNO_STATE.stackPenalty;
      const drawn = drawCardsFromDeck(penaltyCount);
      player.hand.push(...drawn);
      UNO_STATE.stackPenalty = 0;
      UNO_STATE.stackCardType = null;
      player.calledUno = false;

      if (window.AUDIO) AUDIO.play('uno_strike');
      appendLog(`💥 ${player.name} 无牌可接，被重罚摸入 ${penaltyCount} 张牌！并跳过本回合！`);
      advanceTurn(false);
      return;
    }

    // 2. 正常无牌或自愿摸牌
    const drawn = drawCardsFromDeck(1);
    if (drawn.length > 0) {
      const card = drawn[0];
      player.hand.push(card);
      player.calledUno = false;
      if (window.AUDIO) AUDIO.play('uno_draw');
      appendLog(`${player.name} 摸了 1 张牌`);

      // 检查刚摸到的牌是否立即可出
      if (canPlayCard(card, player)) {
        if (!player.isAi) {
          // 人类玩家：高亮并给予即刻打出提示，更新手牌
          updateUI();
          return;
        } else {
          // AI 立即打出
          const cardIdx = player.hand.length - 1;
          setTimeout(() => {
            playCard(player, cardIdx);
          }, 600);
          return;
        }
      }
    }

    advanceTurn(false);
  }

  // ==========================================================================
  // 6. 喊 UNO 与 抓漏 (Catch) 机制
  // ==========================================================================
  function triggerUnoDangerWindow(player) {
    UNO_STATE.unoDangerPlayerId = player.id;
    UNO_STATE.unoPenaltyCaught = false;

    // 如果是人类玩家，开启 3 秒抓漏窗口
    if (!player.isAi) {
      clearTimeout(UNO_STATE.unoCallTimer);
      UNO_STATE.unoCallTimer = setTimeout(() => {
        // 3秒后若未喊 UNO，AI 可能会抓漏！
        if (UNO_STATE.unoDangerPlayerId === player.id && !player.calledUno && !UNO_STATE.unoPenaltyCaught) {
          aiAttemptCatchUno(player);
        }
      }, 2600);
    } else {
      // AI 拟真反应：在 0.5s~1.2s 内自动喊 UNO
      const delay = 500 + Math.random() * 800;
      setTimeout(() => {
        if (UNO_STATE.unoDangerPlayerId === player.id && !UNO_STATE.unoPenaltyCaught && player.hand.length === 1) {
          callUno(player);
        }
      }, delay);
    }
  }

  function callUno(player) {
    if (player.hand.length !== 1) return;
    player.calledUno = true;
    UNO_STATE.unoDangerPlayerId = null;
    clearTimeout(UNO_STATE.unoCallTimer);

    if (window.AUDIO) AUDIO.play('uno_call');
    showFloatingNotice(`📣 ${player.name} 狂喊了 【UNO!】`, '#f59e0b');
    appendLog(`📣 ${player.name} 及时大喊 【UNO!】！`);
    updateUI();
  }

  function catchUno(accuser) {
    // 判定是否有漏喊 UNO 的对手
    const target = UNO_STATE.players.find(p => p.hand.length === 1 && !p.calledUno);
    if (!target) {
      showToast('❌ 当前没有漏喊 UNO 的玩家！');
      return;
    }

    UNO_STATE.unoPenaltyCaught = true;
    UNO_STATE.unoDangerPlayerId = null;
    clearTimeout(UNO_STATE.unoCallTimer);

    // 罚抽 2 张
    const penaltyCards = drawCardsFromDeck(2);
    target.hand.push(...penaltyCards);
    target.calledUno = false;

    if (window.AUDIO) AUDIO.play('uno_catch');
    showFloatingNotice(`🚨 抓漏成功！${target.name} 漏喊 UNO 罚抽 2 张！`, '#ef4444');
    appendLog(`🚨 ${accuser.name} 抓漏成功！${target.name} 被罚抽 2 张牌！`);
    updateUI();
  }

  function aiAttemptCatchUno(targetPlayer) {
    // 70% 概率 AI 成功抓漏
    if (Math.random() < 0.75) {
      const aiAccuser = UNO_STATE.players.find(p => p.isAi && p.id !== targetPlayer.id);
      if (aiAccuser) {
        catchUno(aiAccuser);
      }
    }
  }

  // ==========================================================================
  // 7. 高阶智能 AI 决策 (Smart UNO Bot)
  // ==========================================================================
  function checkNextTurn() {
    clearTimeout(UNO_STATE.aiTimer);
    if (UNO_STATE.phase !== 'PLAYING') return;

    const currentP = UNO_STATE.players[UNO_STATE.turnIndex];
    if (currentP.isAi) {
      UNO_STATE.aiTimer = setTimeout(() => {
        executeAiDecision(currentP);
      }, 900 + Math.random() * 400);
    }
  }

  function executeAiDecision(ai) {
    if (UNO_STATE.phase !== 'PLAYING') return;

    // 检查是否有漏喊 UNO 的人类玩家可抓漏
    const uncalledHuman = UNO_STATE.players.find(p => !p.isAi && p.hand.length === 1 && !p.calledUno);
    if (uncalledHuman && Math.random() < 0.65) {
      catchUno(ai);
    }

    const playable = getPlayableCards(ai);

    // 无牌可出 -> 摸牌
    if (playable.length === 0) {
      playerDrawTurn(ai);
      return;
    }

    // 启发式出牌策略选择：
    // 1. 如果下家手牌只有 1~2 张 (UNO Danger)，优先打出进攻牌 (Draw2, Wild+4, Skip, Reverse)
    const nextP = UNO_STATE.players[getNextPlayerIndex()];
    let chosenCard = null;

    if (nextP.hand.length <= 2) {
      chosenCard = playable.find(c => c.type === CARD_TYPES.WILD_DRAW4) ||
                   playable.find(c => c.type === CARD_TYPES.DRAW2) ||
                   playable.find(c => c.type === CARD_TYPES.SKIP) ||
                   playable.find(c => c.type === CARD_TYPES.REVERSE);
    }

    // 2. 否则优先打出手中最优势颜色的数字牌 (保留万能牌至决胜局)
    if (!chosenCard) {
      const dominantColor = aiPickDominantColor(ai);
      chosenCard = playable.find(c => c.color === dominantColor && c.type === CARD_TYPES.NUMBER) ||
                   playable.find(c => c.type === CARD_TYPES.NUMBER) ||
                   playable.find(c => c.type === CARD_TYPES.SKIP || c.type === CARD_TYPES.REVERSE || c.type === CARD_TYPES.DRAW2) ||
                   playable[0];
    }

    const cardIndex = ai.hand.indexOf(chosenCard);
    const chosenColor = chosenCard.color === 'WILD' ? aiPickDominantColor(ai) : null;
    playCard(ai, cardIndex, chosenColor);
  }

  function aiPickDominantColor(player) {
    const counts = { RED: 0, YELLOW: 0, GREEN: 0, BLUE: 0 };
    player.hand.forEach(c => {
      if (counts[c.color] !== undefined) counts[c.color]++;
    });
    let best = 'RED';
    let max = -1;
    for (let col in counts) {
      if (counts[col] > max) {
        max = counts[col];
        best = col;
      }
    }
    return best;
  }

  // ==========================================================================
  // 8. 终局结算与分数统计
  // ==========================================================================
  function handleRoundVictory(winner) {
    UNO_STATE.phase = 'ROUND_OVER';
    clearTimeout(UNO_STATE.aiTimer);
    clearTimeout(UNO_STATE.unoCallTimer);

    // 计算当局胜利者得分 (累计所有对手剩余手牌分值)
    let roundPoints = 0;
    UNO_STATE.players.forEach(p => {
      if (p.id !== winner.id) {
        p.hand.forEach(c => { roundPoints += c.score; });
      }
    });

    winner.score += roundPoints;

    if (window.AUDIO) AUDIO.play('uno_win');
    appendLog(`🏆 【${winner.name}】 清空手牌，斩获第 ${UNO_STATE.roundNumber} 局胜利！本局斩获 +${roundPoints} 分！`);

    updateUI();

    // 检查是否达到总胜场目标分 (默认 250 分)
    if (winner.score >= UNO_STATE.targetScore) {
      UNO_STATE.matchWinner = winner;
      UNO_STATE.phase = 'GAME_OVER';
      showVictoryModal(`👑 【${winner.name}】 最终以 ${winner.score} 分荣登乌诺牌总冠军！`);
    } else {
      showRoundVictoryModal(winner, roundPoints);
    }
  }

  // ==========================================================================
  // 9. UI 渲染与动效绑定
  // ==========================================================================
  function updateUI() {
    renderSeats();
    renderCenterTable();
    renderPlayerHand();
    renderActionButtons();
  }

  function renderSeats() {
    const grid = document.getElementById('uno-seats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    UNO_STATE.players.forEach((p, idx) => {
      const isTurn = idx === UNO_STATE.turnIndex;
      const cardEl = document.createElement('div');
      cardEl.className = `seat-card ${p.colorClass} ${isTurn ? 'active-turn' : ''}`;

      cardEl.innerHTML = `
        <div class="seat-head">
          <span>${p.name}</span>
          ${isTurn ? '<span class="seat-turn-badge">出牌中</span>' : ''}
        </div>
        <div class="seat-body">
          <div class="seat-stat">
            <span class="stat-label">手牌:</span>
            <span class="seat-cards-count">${p.hand.length} 张</span>
          </div>
          <div class="seat-stat">
            <span class="stat-label">总分:</span>
            <span class="seat-score">${p.score}</span>
          </div>
          ${p.hand.length === 1 ? `<span class="seat-uno-pill ${p.calledUno ? 'called' : 'danger'}">${p.calledUno ? 'UNO!' : '⚠️ 漏喊'}</span>` : ''}
        </div>
      `;
      grid.appendChild(cardEl);
    });
  }

  function renderCenterTable() {
    // 1. 弃牌堆顶牌展示
    const currentCardEl = document.getElementById('uno-top-card');
    if (currentCardEl && UNO_STATE.currentCard) {
      const c = UNO_STATE.currentCard;
      const colorHex = COLORS[UNO_STATE.currentColor].hex;
      currentCardEl.style.backgroundColor = colorHex;
      currentCardEl.style.boxShadow = `0 8px 30px ${COLORS[UNO_STATE.currentColor].glow}`;
      currentCardEl.innerHTML = `
        <div class="uno-card-inner">
          <div class="uno-card-corner top-left">${c.label}</div>
          <div class="uno-card-oval">
            <span class="uno-card-symbol">${c.label}</span>
          </div>
          <div class="uno-card-corner bottom-right">${c.label}</div>
        </div>
      `;
    }

    // 2. 摸牌堆牌数
    const deckCountEl = document.getElementById('uno-deck-count');
    if (deckCountEl) deckCountEl.textContent = `${UNO_STATE.deck.length} 张`;

    // 3. 顺/逆时针流向光环动画
    const flowHalo = document.getElementById('uno-turn-flow');
    if (flowHalo) {
      flowHalo.className = `turn-flow-indicator ${UNO_STATE.direction === 1 ? 'clockwise' : 'counter-clockwise'}`;
      flowHalo.title = UNO_STATE.direction === 1 ? '当前为顺时针出牌' : '当前为逆时针出牌';
    }

    // 4. 当前颜色发光指示器
    const colorGem = document.getElementById('uno-active-color-gem');
    if (colorGem) {
      colorGem.style.backgroundColor = COLORS[UNO_STATE.currentColor].hex;
      colorGem.style.boxShadow = `0 0 16px ${COLORS[UNO_STATE.currentColor].glow}`;
      colorGem.textContent = COLORS[UNO_STATE.currentColor].name;
    }

    // 5. 待罚抽提示
    const penaltyBanner = document.getElementById('uno-penalty-banner');
    if (penaltyBanner) {
      if (UNO_STATE.stackPenalty > 0) {
        penaltyBanner.style.display = 'block';
        penaltyBanner.textContent = `⚡ 连环惩罚生效中：下家若无法接牌需罚抽 ${UNO_STATE.stackPenalty} 张！`;
      } else {
        penaltyBanner.style.display = 'none';
      }
    }
  }

  function renderPlayerHand() {
    const handContainer = document.getElementById('uno-player-hand');
    if (!handContainer) return;
    handContainer.innerHTML = '';

    const activePlayer = UNO_STATE.players[UNO_STATE.turnIndex];
    const isHumanTurn = !activePlayer.isAi;

    // 单人模式或本地多人轮到自己
    const viewPlayer = (!activePlayer.isAi) ? activePlayer : UNO_STATE.players[0];

    // 如果开启了隐私暗牌且未按下查看
    const antiPeekActive = (UNO_STATE.mode.startsWith('LOCAL') && !UNO_STATE.antiPeekHeld);
    const coverEl = document.getElementById('uno-anti-peek-cover');
    if (coverEl) coverEl.style.display = antiPeekActive ? 'flex' : 'none';

    viewPlayer.hand.forEach((card, idx) => {
      const isPlayable = isHumanTurn && viewPlayer.id === activePlayer.id && canPlayCard(card, viewPlayer);
      const cardEl = document.createElement('div');
      const cColor = card.color === 'WILD' ? '#1e1b4b' : COLORS[card.color].hex;

      cardEl.className = `uno-card ${isPlayable ? 'playable' : 'disabled'} ${card.color.toLowerCase()}`;
      cardEl.style.backgroundColor = cColor;
      cardEl.innerHTML = `
        <div class="uno-card-inner">
          <div class="uno-card-corner top-left">${card.label}</div>
          <div class="uno-card-oval">
            <span class="uno-card-symbol">${card.label}</span>
          </div>
          <div class="uno-card-corner bottom-right">${card.label}</div>
        </div>
      `;

      if (isPlayable) {
        cardEl.onclick = () => {
          playCard(viewPlayer, idx);
        };
      }

      handContainer.appendChild(cardEl);
    });
  }

  function renderActionButtons() {
    const activePlayer = UNO_STATE.players[UNO_STATE.turnIndex];
    const isHumanTurn = !activePlayer.isAi && UNO_STATE.phase === 'PLAYING';

    // 摸牌按钮
    const drawBtn = document.getElementById('btn-uno-draw');
    if (drawBtn) {
      drawBtn.disabled = !isHumanTurn;
      if (UNO_STATE.stackPenalty > 0) {
        drawBtn.innerHTML = `💥 受罚摸入 ${UNO_STATE.stackPenalty} 张并跳过`;
        drawBtn.classList.add('penalty');
      } else {
        drawBtn.innerHTML = `🃏 无牌可出 · 摸 1 张`;
        drawBtn.classList.remove('penalty');
      }
    }

    // 喊 UNO 按钮状态
    const unoBtn = document.getElementById('btn-call-uno');
    if (unoBtn) {
      const humanPlayer = UNO_STATE.players.find(p => !p.isAi);
      const canCall = humanPlayer && humanPlayer.hand.length === 1 && !humanPlayer.calledUno;
      unoBtn.classList.toggle('active-glow', canCall);
      unoBtn.disabled = !canCall;
    }

    // 抓漏按钮状态
    const catchBtn = document.getElementById('btn-catch-uno');
    if (catchBtn) {
      const canCatch = UNO_STATE.players.some(p => p.hand.length === 1 && !p.calledUno && (!p.isAi || p.id !== activePlayer.id));
      catchBtn.classList.toggle('active-alert', canCatch);
      catchBtn.disabled = !canCatch;
    }
  }

  // ==========================================================================
  // 10. 变色转盘交互 (Color Picker Modal)
  // ==========================================================================
  let pendingWildCard = null;

  function openColorPickerModal(card) {
    pendingWildCard = card;
    const modal = document.getElementById('uno-color-modal');
    if (modal) modal.style.display = 'flex';
  }

  window.selectUnoColor = function(colorKey) {
    const modal = document.getElementById('uno-color-modal');
    if (modal) modal.style.display = 'none';

    UNO_STATE.phase = 'PLAYING';
    const activePlayer = UNO_STATE.players[UNO_STATE.turnIndex];

    UNO_STATE.currentColor = colorKey;
    if (window.AUDIO) AUDIO.play('uno_wild');
    appendLog(`🌈 你选择了 【${COLORS[colorKey].name}色】！`);

    if (pendingWildCard && pendingWildCard.type === CARD_TYPES.WILD_DRAW4) {
      UNO_STATE.stackPenalty += 4;
      UNO_STATE.stackCardType = CARD_TYPES.WILD_DRAW4;
      if (window.AUDIO) AUDIO.play('uno_strike');
      appendLog(`💣 王牌 +4 发动！下家面临罚抽 ${UNO_STATE.stackPenalty} 张！`);
    }

    pendingWildCard = null;
    advanceTurn(false);
  };

  // ==========================================================================
  // 11. 对局日志与通用提示
  // ==========================================================================
  function appendLog(text) {
    const logBox = document.getElementById('uno-log-list');
    if (!logBox) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const li = document.createElement('li');
    li.innerHTML = `<span class="log-time">${time}</span> ${text}`;
    logBox.prepend(li);
    while (logBox.children.length > 25) {
      logBox.removeChild(logBox.lastChild);
    }
  }

  function showFloatingNotice(text, color = '#f59e0b') {
    const notice = document.getElementById('uno-floating-notice');
    if (!notice) return;
    notice.textContent = text;
    notice.style.borderColor = color;
    notice.style.boxShadow = `0 8px 30px ${color}`;
    notice.classList.add('show');
    setTimeout(() => {
      notice.classList.remove('show');
    }, 2200);
  }

  function showRoundVictoryModal(winner, points) {
    const modal = document.getElementById('uno-round-modal');
    if (!modal) return;
    document.getElementById('uno-round-winner-title').textContent = `🎉 ${winner.name} 斩获第 ${UNO_STATE.roundNumber} 局胜利！`;
    document.getElementById('uno-round-points-detail').innerHTML = `本局获得分值: <strong>+${points}</strong> 分 (当前总分: <strong>${winner.score} / ${UNO_STATE.targetScore}</strong>)`;
    modal.style.display = 'flex';
  }

  function showVictoryModal(text) {
    const modal = document.getElementById('uno-victory-modal');
    if (!modal) return;
    document.getElementById('uno-victory-text').textContent = text;
    modal.style.display = 'flex';
  }

  window.closeUnoModals = function() {
    const m1 = document.getElementById('uno-round-modal');
    const m2 = document.getElementById('uno-victory-modal');
    if (m1) m1.style.display = 'none';
    if (m2) m2.style.display = 'none';
  };

  window.nextUnoRound = function() {
    closeUnoModals();
    UNO_STATE.roundNumber++;
    startUnoGame(false);
  };

  window.restartUnoMatch = function() {
    closeUnoModals();
    startUnoGame(true);
  };

  // ==========================================================================
  // 12. 外部交互接口与初始化挂载
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 摸牌按钮绑定
    const drawBtn = document.getElementById('btn-uno-draw');
    if (drawBtn) drawBtn.onclick = handleDrawButton;

    // 摸牌牌堆直接点击
    const deckPile = document.getElementById('uno-deck-pile');
    if (deckPile) deckPile.onclick = handleDrawButton;

    // 喊 UNO 按钮
    const unoBtn = document.getElementById('btn-call-uno');
    if (unoBtn) {
      unoBtn.onclick = () => {
        const human = UNO_STATE.players.find(p => !p.isAi);
        if (human) callUno(human);
      };
    }

    // 抓漏按钮
    const catchBtn = document.getElementById('btn-catch-uno');
    if (catchBtn) {
      catchBtn.onclick = () => {
        const human = UNO_STATE.players.find(p => !p.isAi) || UNO_STATE.players[0];
        catchUno(human);
      };
    }

    // 模式切换按钮
    const modeBtns = document.querySelectorAll('.uno-mode-btn');
    modeBtns.forEach(btn => {
      btn.onclick = () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        UNO_STATE.mode = btn.dataset.mode;
        startUnoGame(true);
      };
    });

    // 房规开关切换 (叠牌模式)
    const stackToggle = document.getElementById('toggle-rule-stacking');
    if (stackToggle) {
      stackToggle.onchange = (e) => {
        UNO_STATE.houseRules.stacking = e.target.checked;
        showToast(UNO_STATE.houseRules.stacking ? '✅ 已开启连环叠牌反弹' : 'ℹ️ 已切换为标准不叠牌规则');
      };
    }

    // 本地暗牌展开长按手势
    const peekBtn = document.getElementById('btn-anti-peek-hold');
    if (peekBtn) {
      const showPeek = () => {
        UNO_STATE.antiPeekHeld = true;
        renderPlayerHand();
      };
      const hidePeek = () => {
        UNO_STATE.antiPeekHeld = false;
        renderPlayerHand();
      };
      peekBtn.addEventListener('mousedown', showPeek);
      peekBtn.addEventListener('mouseup', hidePeek);
      peekBtn.addEventListener('mouseleave', hidePeek);
      peekBtn.addEventListener('touchstart', (e) => { e.preventDefault(); showPeek(); });
      peekBtn.addEventListener('touchend', hidePeek);
    }

    // 默认开启游戏
    startUnoGame(true);
  });

  // 挂载至全局以供自动化测试调用
  window.UNO_ENGINE = {
    STATE: UNO_STATE,
    buildUnoDeck,
    shuffle,
    canPlayCard,
    getPlayableCards,
    startUnoGame,
    playCard,
    callUno,
    catchUno,
    aiPickDominantColor
  };

})();
