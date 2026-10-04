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
    } else if (UNO_STATE.mode === 'ONLINE') {
      const colors = ['seat-p1', 'seat-p2', 'seat-p3', 'seat-p4'];
      const defaultNames = ['🔴 房主', '🟢 玩家 2', '🔵 玩家 3', '🟡 玩家 4'];
      configs = [0, 1, 2, 3].map(idx => {
        const rp = UNO_NETWORK.roomPlayers[idx];
        const isMe = idx === UNO_NETWORK.mySeatIndex;
        let displayName = rp ? rp.name : defaultNames[idx];
        if (isMe && !displayName.includes('(你)')) displayName += ' (你)';
        return {
          id: idx + 1,
          seatIndex: idx,
          name: displayName,
          isAi: rp ? !!rp.isAi : true,
          colorClass: colors[idx]
        };
      });
    }

    UNO_STATE.players = configs.map(c => ({
      id: c.id,
      seatIndex: c.seatIndex !== undefined ? c.seatIndex : (c.id - 1),
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

  function playCard(player, cardIndex, chosenColor = null, isRemote = false) {
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

    // 在线模式：本地主动操作时广播至网络对端
    if (UNO_STATE.mode === 'ONLINE' && !isRemote) {
      UNO_NETWORK.sendAction('PLAY_CARD', {
        seatIndex: player.seatIndex !== undefined ? player.seatIndex : (player.id - 1),
        cardIndex,
        cardId: card.id,
        chosenColor
      });
    }

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
        const isLocalHuman = (UNO_STATE.mode === 'ONLINE')
          ? (player.seatIndex === UNO_NETWORK.mySeatIndex)
          : !player.isAi;

        if (isLocalHuman) {
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
    if (UNO_STATE.phase !== 'PLAYING') return;

    if (UNO_STATE.mode === 'ONLINE') {
      if (UNO_STATE.turnIndex !== UNO_NETWORK.mySeatIndex) return;
    } else {
      if (activePlayer.isAi) return;
    }

    playerDrawTurn(activePlayer);
  }

  function playerDrawTurn(player, isRemote = false) {
    if (UNO_STATE.mode === 'ONLINE' && !isRemote) {
      UNO_NETWORK.sendAction('DRAW_CARD', {
        seatIndex: player.seatIndex !== undefined ? player.seatIndex : (player.id - 1)
      });
    }

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
        const isLocalHuman = (UNO_STATE.mode === 'ONLINE')
          ? (player.seatIndex === UNO_NETWORK.mySeatIndex)
          : !player.isAi;

        if (isLocalHuman) {
          // 人类玩家：高亮并给予即刻打出提示，更新手牌
          updateUI();
          return;
        } else if (player.isAi) {
          // 仅在 AI 时立即打出 (如果是 ONLINE 模式由 Host 触发)
          if (UNO_STATE.mode === 'ONLINE' && !UNO_NETWORK.isHost) {
            updateUI();
            return;
          }
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

  function callUno(player, isRemote = false) {
    if (player.hand.length !== 1) return;
    player.calledUno = true;
    UNO_STATE.unoDangerPlayerId = null;
    clearTimeout(UNO_STATE.unoCallTimer);

    if (window.AUDIO) AUDIO.play('uno_call');
    showFloatingNotice(`📣 ${player.name} 狂喊了 【UNO!】`, '#f59e0b');
    appendLog(`📣 ${player.name} 及时大喊 【UNO!】！`);

    if (UNO_STATE.mode === 'ONLINE' && !isRemote) {
      UNO_NETWORK.sendAction('CALL_UNO', {
        seatIndex: player.seatIndex !== undefined ? player.seatIndex : (player.id - 1)
      });
    }

    updateUI();
  }

  function catchUno(accuser, explicitTarget = null, isRemote = false) {
    // 判定是否有漏喊 UNO 的对手
    const target = explicitTarget || UNO_STATE.players.find(p => p.hand.length === 1 && !p.calledUno);
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

    if (UNO_STATE.mode === 'ONLINE' && !isRemote) {
      UNO_NETWORK.sendAction('CATCH_UNO', {
        reporterSeatIndex: accuser.seatIndex !== undefined ? accuser.seatIndex : (accuser.id - 1),
        targetSeatIndex: target.seatIndex !== undefined ? target.seatIndex : (target.id - 1)
      });
    }

    updateUI();
  }

  function aiAttemptCatchUno(targetPlayer) {
    // 如果在线模式且非房主，不执行 AI 抓漏
    if (UNO_STATE.mode === 'ONLINE' && !UNO_NETWORK.isHost) return;

    // 70% 概率 AI 成功抓漏
    if (Math.random() < 0.75) {
      const aiAccuser = UNO_STATE.players.find(p => p.isAi && p.id !== targetPlayer.id);
      if (aiAccuser) {
        catchUno(aiAccuser, targetPlayer);
      }
    }
  }

  // ==========================================================================
  // 7. 高阶智能 AI 决策 (Smart UNO Bot)
  // ==========================================================================
  function checkNextTurn() {
    clearTimeout(UNO_STATE.aiTimer);
    if (UNO_STATE.phase !== 'PLAYING') return;

    // 在在线模式下，仅房主 (Host) 执行 AI 逻辑，避免多个客户端重复执行
    if (UNO_STATE.mode === 'ONLINE' && !UNO_NETWORK.isHost) {
      return;
    }

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
    if (!activePlayer) return;

    let viewPlayer;
    let isHumanTurn;

    if (UNO_STATE.mode === 'ONLINE') {
      const mySeat = UNO_NETWORK.mySeatIndex;
      viewPlayer = (mySeat >= 0 && mySeat < UNO_STATE.players.length) ? UNO_STATE.players[mySeat] : UNO_STATE.players[0];
      isHumanTurn = (UNO_STATE.turnIndex === mySeat) && (UNO_STATE.phase === 'PLAYING');
    } else {
      viewPlayer = (!activePlayer.isAi) ? activePlayer : UNO_STATE.players[0];
      isHumanTurn = !activePlayer.isAi && (UNO_STATE.phase === 'PLAYING');
    }

    // 本地多人暗牌保护遮罩 (在线模式无需暗牌)
    const antiPeekActive = (UNO_STATE.mode.startsWith('LOCAL') && !UNO_STATE.antiPeekHeld);
    const coverEl = document.getElementById('uno-anti-peek-cover');
    if (coverEl) coverEl.style.display = antiPeekActive ? 'flex' : 'none';

    // 手牌张数文字提示
    const handCountText = document.getElementById('uno-hand-count-text');
    if (handCountText) {
      handCountText.textContent = `(${viewPlayer.hand.length} 张)`;
    }

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
    if (!activePlayer) return;

    const mySeat = UNO_NETWORK.mySeatIndex;
    const isHumanTurn = (UNO_STATE.mode === 'ONLINE')
      ? (UNO_STATE.turnIndex === mySeat && UNO_STATE.phase === 'PLAYING')
      : (!activePlayer.isAi && UNO_STATE.phase === 'PLAYING');

    // 摸牌按钮
    const drawBtn = document.getElementById('btn-uno-draw');
    if (drawBtn) {
      drawBtn.disabled = !isHumanTurn;
      if (UNO_STATE.mode === 'ONLINE' && !isHumanTurn) {
        drawBtn.innerHTML = `⏳ 等待对方出牌...`;
        drawBtn.classList.remove('penalty');
      } else if (UNO_STATE.stackPenalty > 0) {
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
      const myPlayer = (UNO_STATE.mode === 'ONLINE' && mySeat >= 0)
        ? UNO_STATE.players[mySeat]
        : UNO_STATE.players.find(p => !p.isAi);
      const canCall = myPlayer && myPlayer.hand.length === 1 && !myPlayer.calledUno;
      unoBtn.classList.toggle('active-glow', canCall);
      unoBtn.disabled = !canCall;
    }

    // 抓漏按钮状态
    const catchBtn = document.getElementById('btn-catch-uno');
    if (catchBtn) {
      const myId = (UNO_STATE.mode === 'ONLINE' && mySeat >= 0)
        ? UNO_STATE.players[mySeat]?.id
        : null;
      const canCatch = UNO_STATE.players.some(p => p.hand.length === 1 && !p.calledUno && (myId ? p.id !== myId : true));
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

  window.selectUnoColor = function(colorKey, isRemote = false) {
    const modal = document.getElementById('uno-color-modal');
    if (modal) modal.style.display = 'none';

    UNO_STATE.phase = 'PLAYING';

    UNO_STATE.currentColor = colorKey;
    if (window.AUDIO) AUDIO.play('uno_wild');
    appendLog(`🌈 选色生效：当前颜色变更为 【${COLORS[colorKey].name}色】！`);

    if (pendingWildCard && pendingWildCard.type === CARD_TYPES.WILD_DRAW4) {
      UNO_STATE.stackPenalty += 4;
      UNO_STATE.stackCardType = CARD_TYPES.WILD_DRAW4;
      if (window.AUDIO) AUDIO.play('uno_strike');
      appendLog(`💣 王牌 +4 发动！下家面临罚抽 ${UNO_STATE.stackPenalty} 张！`);
    }

    pendingWildCard = null;

    if (UNO_STATE.mode === 'ONLINE' && !isRemote) {
      UNO_NETWORK.sendAction('SELECT_COLOR', { colorKey });
    }

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

  window.nextUnoRound = function(isRemote = false) {
    closeUnoModals();
    UNO_STATE.roundNumber++;

    if (UNO_STATE.mode === 'ONLINE') {
      if (!isRemote) {
        if (UNO_NETWORK.isHost) {
          startHostOnlineGame();
        } else {
          showToast('⏳ 等待房主开启下一局...');
        }
      }
      return;
    }

    startUnoGame(false);
  };

  window.restartUnoMatch = function(isRemote = false) {
    closeUnoModals();

    if (UNO_STATE.mode === 'ONLINE') {
      if (!isRemote) {
        if (UNO_NETWORK.isHost) {
          UNO_STATE.roundNumber = 1;
          startHostOnlineGame();
        } else {
          showToast('⏳ 等待房主重新开启对局...');
        }
      }
      return;
    }

    startUnoGame(true);
  };

  // ==========================================================================
  // 12. 在线联机网络中枢 (UNO NETWORK & CLOUDFLARE WORKER / PAGES FUNCTIONS)
  // ==========================================================================
  const PUBLIC_WORKER_FALLBACK = 'wss://uno-hub.party-games.workers.dev/ws';

  function getDefaultWorkerUrl() {
    // 1. 若用户在设置面板手动保存过专属 Worker URL，优先使用
    const saved = localStorage.getItem('uno_worker_url');
    if (saved && saved.trim()) return saved.trim();

    // 2. 若当前运行在 HTTP/HTTPS 环境 (如 Cloudflare Pages 的 *.pages.dev 或自定义域名)
    if (typeof window !== 'undefined' && window.location && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss://' : 'ws://';
      // 零配置同源直连：由 Cloudflare Pages Functions (/functions/ws.js) 自动全权承载
      return `${wsProto}${window.location.host}/ws`;
    }

    // 3. 本地以 file:// 双击直接运行时，回退至公共节点
    return PUBLIC_WORKER_FALLBACK;
  }

  const FUN_NAMES = [
    '乌诺闪电侠', '极光爆牌手', '七彩神牌王', '超级反转王', 
    '红黄蓝绿星', '绝对不加4', '反弹大师', '牌局预言家',
    '摸牌狂魔', '无情跳过侠', '乌诺战神', '幸运大魔王'
  ];

  function getRandomUnoName() {
    return FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
  }

  const UNO_NETWORK = {
    ws: null,
    serverUrl: getDefaultWorkerUrl(),
    roomId: null,
    myPlayerName: localStorage.getItem('uno_player_name') || getRandomUnoName(),
    myClientId: localStorage.getItem('uno_client_id') || ('uno_cli_' + Math.random().toString(36).substr(2, 9)),
    mySeatIndex: -1,
    isHost: false,
    roomPlayers: [],
    pingTimer: null,

    init() {
      localStorage.setItem('uno_client_id', this.myClientId);
      localStorage.setItem('uno_player_name', this.myPlayerName);
    },

    connect(roomId, playerName, isCreate = false) {
      this.disconnect();
      this.roomId = roomId;
      this.myPlayerName = playerName || this.myPlayerName;
      localStorage.setItem('uno_player_name', this.myPlayerName);

      let url = this.serverUrl ? this.serverUrl.trim() : '';
      if (!url) url = getDefaultWorkerUrl();

      if (url.startsWith('http://')) url = url.replace('http://', 'ws://');
      else if (url.startsWith('https://')) url = url.replace('https://', 'wss://');
      else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        url = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + url;
      }

      const wsUrl = `${url}${url.includes('?') ? '&' : '?'}room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(this.myPlayerName)}&clientId=${encodeURIComponent(this.myClientId)}&create=${isCreate ? '1' : '0'}`;

      showFloatingNotice(`🌐 正在连接联机房间 ${roomId}...`, '#38bdf8');

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        showToast('❌ WebSocket 连接失败: ' + err.message);
        return;
      }

      this.ws.onopen = () => {
        showToast(`✅ 已接入联机中枢，房间号: ${roomId}`);
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[UNO Network] Message parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[UNO Network] WebSocket error:', err);
        showToast('⚠️ 联机中枢未连接成功，可在下方「服务器配置」填入您的 Cloudflare Worker 域名！');
      };

      this.ws.onclose = (event) => {
        clearInterval(this.pingTimer);
        console.log('[UNO Network] WebSocket closed:', event.code);
        if (UNO_STATE.mode === 'ONLINE' && UNO_STATE.phase === 'PLAYING') {
          showFloatingNotice('⚠️ 联机连接已断开', '#ef4444');
        }
        updateOnlineBar();
      };
    },

    disconnect() {
      clearInterval(this.pingTimer);
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
        this.ws = null;
      }
      this.roomId = null;
      this.mySeatIndex = -1;
      this.isHost = false;
      this.roomPlayers = [];
      updateOnlineBar();
    },

    send(msg) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    },

    sendAction(action, payload) {
      this.send({
        type: 'GAME_ACTION',
        action: action,
        payload: payload,
        syncId: Date.now()
      });
    },

    handleMessage(msg) {
      switch (msg.type) {
        case 'JOINED_SUCCESS':
          this.roomId = msg.roomId;
          this.mySeatIndex = msg.mySeatIndex;
          this.isHost = msg.isHost;
          this.roomPlayers = msg.roomData?.players || [];
          if (msg.roomData?.houseRules) {
            UNO_STATE.houseRules = { ...UNO_STATE.houseRules, ...msg.roomData.houseRules };
          }
          openOnlineLobbyView();
          renderLobbySeats();
          updateOnlineBar();
          break;

        case 'ROOM_UPDATE':
          this.roomPlayers = msg.players || [];
          if (msg.mySeatIndex !== undefined && msg.mySeatIndex !== -1) {
            this.mySeatIndex = msg.mySeatIndex;
          }
          if (msg.hostId) {
            this.isHost = (msg.hostId === this.myClientId);
          }
          if (msg.houseRules) {
            UNO_STATE.houseRules = { ...UNO_STATE.houseRules, ...msg.houseRules };
          }
          renderLobbySeats();
          updateOnlineBar();
          break;

        case 'RULES_UPDATED':
          if (msg.rules) {
            UNO_STATE.houseRules = { ...UNO_STATE.houseRules, ...msg.rules };
            showToast('房规已同步更新');
          }
          break;

        case 'GAME_START':
          this.handleGameStart(msg);
          break;

        case 'GAME_ACTION':
          this.handleRemoteAction(msg);
          break;

        case 'HOST_STATE_SYNC':
          this.handleHostSync(msg.snapshot);
          break;

        case 'PLAYER_LEFT':
          showToast(`席位 ${msg.seatIndex + 1} 玩家已离开房间`);
          if (msg.roomData?.players) {
            this.roomPlayers = msg.roomData.players;
          }
          if (msg.newHostId) {
            this.isHost = (msg.newHostId === this.myClientId);
          }
          if (UNO_STATE.mode === 'ONLINE' && UNO_STATE.phase === 'PLAYING') {
            const leftPlayer = UNO_STATE.players[msg.seatIndex];
            if (leftPlayer) {
              leftPlayer.isAi = true;
              leftPlayer.name = leftPlayer.name.replace(' (你)', '') + ' (托管AI)';
              appendLog(`🤖 玩家离开，席位 ${msg.seatIndex + 1} 已自动转为电脑托管`);
              updateUI();
              checkNextTurn();
            }
          }
          renderLobbySeats();
          updateOnlineBar();
          break;

        case 'ERROR':
          showToast(`❌ ${msg.message || '网络错误'}`);
          break;

        case 'PONG':
          break;
      }
    },

    handleGameStart(msg) {
      closeOnlineModal();
      UNO_STATE.mode = 'ONLINE';

      // 切换模式按钮高亮
      document.querySelectorAll('.uno-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === 'ONLINE');
      });

      // 初始化 4 个席位
      UNO_STATE.players = msg.players.map((p, idx) => ({
        id: idx + 1,
        seatIndex: idx,
        name: idx === this.mySeatIndex ? `${p.name} (你)` : p.name,
        isAi: !!p.isAi,
        colorClass: `seat-p${idx + 1}`,
        hand: msg.initialState?.playersHands ? msg.initialState.playersHands[idx] : [],
        score: 0,
        calledUno: false
      }));

      UNO_STATE.deck = msg.initialState.deck || [];
      UNO_STATE.discardPile = [msg.initialState.firstCard];
      UNO_STATE.currentCard = msg.initialState.firstCard;
      UNO_STATE.currentColor = msg.initialState.currentColor;
      UNO_STATE.turnIndex = msg.initialState.turnIndex || 0;
      UNO_STATE.direction = msg.initialState.direction || 1;
      UNO_STATE.stackPenalty = msg.initialState.stackPenalty || 0;
      UNO_STATE.stackCardType = msg.initialState.stackCardType || null;
      UNO_STATE.phase = 'PLAYING';
      UNO_STATE.roundNumber = msg.initialState.roundNumber || 1;
      UNO_STATE.antiPeekHeld = false;

      updateOnlineBar();
      updateUI();
      appendLog(`🏁 在线对决正式开启！底牌为 [${COLORS[UNO_STATE.currentColor].name} ${UNO_STATE.currentCard.label}]`);
      showFloatingNotice(`🎮 对决开启！底牌为 [${COLORS[UNO_STATE.currentColor].name} ${UNO_STATE.currentCard.label}]`, COLORS[UNO_STATE.currentColor].hex);

      checkNextTurn();
    },

    handleRemoteAction(msg) {
      if (UNO_STATE.mode !== 'ONLINE' || UNO_STATE.phase !== 'PLAYING') return;

      const { seatIndex, action, payload } = msg;
      const player = UNO_STATE.players[seatIndex];
      if (!player) return;

      switch (action) {
        case 'PLAY_CARD':
          let cardIdx = -1;
          if (payload.cardId) {
            cardIdx = player.hand.findIndex(c => c.id === payload.cardId);
          }
          if (cardIdx === -1 && payload.cardIndex !== undefined && payload.cardIndex < player.hand.length) {
            cardIdx = payload.cardIndex;
          }
          if (cardIdx !== -1) {
            playCard(player, cardIdx, payload.chosenColor, true);
          }
          break;

        case 'DRAW_CARD':
          playerDrawTurn(player, true);
          break;

        case 'CALL_UNO':
          callUno(player, true);
          break;

        case 'CATCH_UNO':
          const accuser = UNO_STATE.players[payload.reporterSeatIndex];
          const target = payload.targetSeatIndex !== null && payload.targetSeatIndex !== undefined ? UNO_STATE.players[payload.targetSeatIndex] : null;
          if (accuser) catchUno(accuser, target, true);
          break;

        case 'SELECT_COLOR':
          selectUnoColor(payload.colorKey, true);
          break;

        case 'NEXT_ROUND':
          nextUnoRound(true);
          break;

        case 'RESTART_MATCH':
          restartUnoMatch(true);
          break;
      }
    },

    handleHostSync(snapshot) {
      if (!snapshot || this.isHost) return;
      UNO_STATE.turnIndex = snapshot.turnIndex;
      UNO_STATE.direction = snapshot.direction;
      UNO_STATE.currentColor = snapshot.currentColor;
      UNO_STATE.stackPenalty = snapshot.stackPenalty;
      UNO_STATE.stackCardType = snapshot.stackCardType;
      if (snapshot.currentCard) UNO_STATE.currentCard = snapshot.currentCard;
      if (snapshot.scores) {
        snapshot.scores.forEach((sc, idx) => {
          if (UNO_STATE.players[idx]) UNO_STATE.players[idx].score = sc;
        });
      }
      updateUI();
    }
  };

  function buildInitialGameState(playersConfig, roundNumber = 1) {
    const fullDeck = shuffle(buildUnoDeck());
    const playersHands = [];

    // 发牌给各席位 (每人 7 张)
    playersConfig.forEach(() => {
      playersHands.push(fullDeck.splice(0, 7));
    });

    // 翻出第一张非 Wild+4 底牌
    let firstCard = fullDeck.shift();
    while (firstCard.type === CARD_TYPES.WILD_DRAW4) {
      fullDeck.push(firstCard);
      firstCard = fullDeck.shift();
    }

    let currentColor = firstCard.color === 'WILD' ? 'RED' : firstCard.color;
    let turnIndex = 0;
    let direction = 1;
    let stackPenalty = 0;
    let stackCardType = null;

    if (firstCard.type === CARD_TYPES.SKIP) {
      turnIndex = 1 % playersConfig.length;
    } else if (firstCard.type === CARD_TYPES.REVERSE) {
      direction = -1;
      turnIndex = (playersConfig.length - 1) % playersConfig.length;
    } else if (firstCard.type === CARD_TYPES.DRAW2) {
      stackPenalty = 2;
      stackCardType = CARD_TYPES.DRAW2;
    }

    return {
      deck: fullDeck,
      firstCard,
      currentColor,
      turnIndex,
      direction,
      stackPenalty,
      stackCardType,
      roundNumber,
      playersHands
    };
  }

  function startHostOnlineGame() {
    if (!UNO_NETWORK.isHost) return;

    const fillAi = document.getElementById('lobby-toggle-fill-ai')?.checked ?? true;
    const stacking = document.getElementById('lobby-toggle-stacking')?.checked ?? true;
    UNO_STATE.houseRules.stacking = stacking;

    let players = [];
    for (let i = 0; i < 4; i++) {
      const roomP = UNO_NETWORK.roomPlayers[i];
      if (roomP) {
        players.push({
          id: roomP.id,
          name: roomP.name,
          seatIndex: i,
          isAi: false,
          isHost: roomP.isHost
        });
      } else if (fillAi) {
        players.push({
          id: `ai_${i + 1}`,
          name: `🤖 智子 ${i + 1} (AI)`,
          seatIndex: i,
          isAi: true,
          isHost: false
        });
      }
    }

    if (players.length < 2) {
      showToast('⚠️ 至少需要 2 位玩家或开启 AI 替补才能开启对局！');
      return;
    }

    const initialState = buildInitialGameState(players, UNO_STATE.roundNumber);

    UNO_NETWORK.send({
      type: 'START_GAME',
      initialState: initialState,
      rules: { stacking, fillAi }
    });
  }

  function renderLobbySeats() {
    const list = document.getElementById('lobby-seats-list');
    if (!list) return;
    list.innerHTML = '';

    const colors = ['badge-p1', 'badge-p2', 'badge-p3', 'badge-p4'];
    const pNames = ['P1 (红)', 'P2 (绿)', 'P3 (蓝)', 'P4 (黄)'];

    for (let i = 0; i < 4; i++) {
      const p = UNO_NETWORK.roomPlayers[i];
      const isMe = (i === UNO_NETWORK.mySeatIndex);
      const card = document.createElement('div');
      card.className = `lobby-seat-card ${p ? '' : 'seat-empty'}`;

      if (p) {
        card.innerHTML = `
          <div class="lobby-seat-badge ${colors[i]}">P${i + 1}</div>
          <div class="lobby-seat-info">
            <div class="lobby-player-name">${p.name} ${isMe ? '<span style="color:#f59e0b;">(你)</span>' : ''}</div>
            <div class="lobby-player-tag">${p.isHost ? '👑 房主' : '席位就绪'}</div>
          </div>
          <span class="lobby-seat-status status-online">🟢 已就位</span>
        `;
      } else {
        const fillAi = document.getElementById('lobby-toggle-fill-ai')?.checked ?? true;
        card.innerHTML = `
          <div class="lobby-seat-badge ${colors[i]}" style="opacity:0.5;">P${i + 1}</div>
          <div class="lobby-seat-info">
            <div class="lobby-player-name" style="color:#64748b;">${pNames[i]} 空席</div>
            <div class="lobby-player-tag">${fillAi ? '开局将由 AI 补位' : '等待真人玩家加入'}</div>
          </div>
          <span class="lobby-seat-status status-empty">⚪ 待入座</span>
        `;
      }
      list.appendChild(card);
    }

    const hostPanel = document.getElementById('host-controls-panel');
    const guestHint = document.getElementById('guest-waiting-hint');
    if (hostPanel) hostPanel.style.display = UNO_NETWORK.isHost ? 'flex' : 'none';
    if (guestHint) guestHint.style.display = UNO_NETWORK.isHost ? 'none' : 'flex';

    const codeEl = document.getElementById('lobby-room-code');
    if (codeEl) codeEl.textContent = UNO_NETWORK.roomId || '------';
  }

  function updateOnlineBar() {
    const bar = document.getElementById('uno-online-bar');
    if (!bar) return;
    const isOnlineActive = UNO_STATE.mode === 'ONLINE' || (UNO_NETWORK.ws && UNO_NETWORK.ws.readyState === WebSocket.OPEN);
    bar.style.display = isOnlineActive ? 'flex' : 'none';

    const codeBadge = document.getElementById('online-room-code-badge');
    if (codeBadge) codeBadge.textContent = UNO_NETWORK.roomId || '------';

    const rolePill = document.getElementById('online-my-role-pill');
    if (rolePill) {
      rolePill.textContent = UNO_NETWORK.isHost ? '👑 房主' : `P${UNO_NETWORK.mySeatIndex + 1} 席位`;
      rolePill.style.background = UNO_NETWORK.isHost ? '#f59e0b' : '#3b82f6';
      rolePill.style.color = UNO_NETWORK.isHost ? '#0f172a' : '#ffffff';
    }
  }

  function openOnlineModal() {
    const modal = document.getElementById('uno-online-modal');
    if (!modal) return;
    modal.style.display = 'flex';

    if (UNO_NETWORK.ws && UNO_NETWORK.ws.readyState === WebSocket.OPEN && UNO_NETWORK.roomId) {
      openOnlineLobbyView();
    } else {
      openOnlineConnectView();
    }
  }

  function closeOnlineModal() {
    const modal = document.getElementById('uno-online-modal');
    if (modal) modal.style.display = 'none';
  }

  function openOnlineConnectView() {
    const cView = document.getElementById('online-connect-view');
    const lView = document.getElementById('online-lobby-view');
    if (cView) cView.style.display = 'block';
    if (lView) lView.style.display = 'none';

    const nickInput = document.getElementById('input-online-nickname');
    if (nickInput) nickInput.value = UNO_NETWORK.myPlayerName;

    const workerInput = document.getElementById('input-worker-url');
    if (workerInput) workerInput.value = UNO_NETWORK.serverUrl;
  }

  function openOnlineLobbyView() {
    const cView = document.getElementById('online-connect-view');
    const lView = document.getElementById('online-lobby-view');
    if (cView) cView.style.display = 'none';
    if (lView) lView.style.display = 'block';
    renderLobbySeats();
  }

  function setupOnlineLobby() {
    UNO_NETWORK.init();

    // 随机昵称按钮
    const randBtn = document.getElementById('btn-random-name');
    if (randBtn) {
      randBtn.onclick = () => {
        const name = getRandomUnoName();
        UNO_NETWORK.myPlayerName = name;
        const nickInput = document.getElementById('input-online-nickname');
        if (nickInput) nickInput.value = name;
        localStorage.setItem('uno_player_name', name);
      };
    }

    // 关闭模态弹窗
    const closeBtn = document.getElementById('btn-close-online-modal');
    if (closeBtn) closeBtn.onclick = closeOnlineModal;

    // 创建房间
    const createBtn = document.getElementById('btn-create-room');
    if (createBtn) {
      createBtn.onclick = () => {
        const nickInput = document.getElementById('input-online-nickname');
        const name = (nickInput && nickInput.value.trim()) ? nickInput.value.trim() : getRandomUnoName();
        const roomId = Math.floor(100000 + Math.random() * 900000).toString();
        UNO_NETWORK.connect(roomId, name, true);
      };
    }

    // 加入房间
    const joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) {
      joinBtn.onclick = () => {
        const nickInput = document.getElementById('input-online-nickname');
        const name = (nickInput && nickInput.value.trim()) ? nickInput.value.trim() : getRandomUnoName();
        const roomInput = document.getElementById('input-join-room-id');
        const roomId = roomInput ? roomInput.value.trim() : '';
        if (!roomId || roomId.length < 4) {
          showToast('请输入正确的 6 位房间号！');
          return;
        }
        UNO_NETWORK.connect(roomId, name, false);
      };
    }

    // 保存 Worker 服务器配置
    const saveWorkerBtn = document.getElementById('btn-save-worker-url');
    if (saveWorkerBtn) {
      saveWorkerBtn.onclick = () => {
        const input = document.getElementById('input-worker-url');
        const url = input ? input.value.trim() : '';
        if (url) {
          UNO_NETWORK.serverUrl = url;
          localStorage.setItem('uno_worker_url', url);
          showToast('✅ Cloudflare Worker 服务器配置已保存！');
        }
      };
    }

    // 恢复默认 Worker 配置
    const resetWorkerBtn = document.getElementById('btn-reset-worker-url');
    if (resetWorkerBtn) {
      resetWorkerBtn.onclick = () => {
        localStorage.removeItem('uno_worker_url');
        const defaultUrl = getDefaultWorkerUrl();
        UNO_NETWORK.serverUrl = defaultUrl;
        const input = document.getElementById('input-worker-url');
        if (input) input.value = defaultUrl;
        showToast('已恢复为默认同源/公共 Worker 配置！');
      };
    }

    // 复制房间号
    const copyHandler = () => {
      if (!UNO_NETWORK.roomId) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(UNO_NETWORK.roomId).then(() => {
          showToast(`📋 房间号 ${UNO_NETWORK.roomId} 已复制到剪贴板！`);
        }).catch(() => {
          showToast(`房间号: ${UNO_NETWORK.roomId}`);
        });
      } else {
        showToast(`房间号: ${UNO_NETWORK.roomId}`);
      }
    };
    const copyBtn1 = document.getElementById('btn-lobby-copy-code');
    const copyBtn2 = document.getElementById('btn-bar-copy-room');
    if (copyBtn1) copyBtn1.onclick = copyHandler;
    if (copyBtn2) copyBtn2.onclick = copyHandler;

    // 房主开启游戏
    const hostStartBtn = document.getElementById('btn-host-start-game');
    if (hostStartBtn) hostStartBtn.onclick = startHostOnlineGame;

    // 退出房间
    const leaveHandler = () => {
      UNO_NETWORK.disconnect();
      closeOnlineModal();
      document.querySelectorAll('.uno-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === 'AI3');
      });
      UNO_STATE.mode = 'AI3';
      startUnoGame(true);
      showToast('已退出在线房间，切换为单人模式');
    };
    const leaveBtn1 = document.getElementById('btn-lobby-leave');
    const leaveBtn2 = document.getElementById('btn-bar-leave-room');
    if (leaveBtn1) leaveBtn1.onclick = leaveHandler;
    if (leaveBtn2) leaveBtn2.onclick = leaveHandler;

    // 席位大厅按钮
    const openLobbyBtn = document.getElementById('btn-bar-open-lobby');
    if (openLobbyBtn) openLobbyBtn.onclick = openOnlineModal;

    // URL 房间参数自动填入
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      openOnlineModal();
      const joinInput = document.getElementById('input-join-room-id');
      if (joinInput) joinInput.value = roomParam;
    }
  }

  // ==========================================================================
  // 13. 外部交互接口与初始化挂载
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
        let myPlayer;
        if (UNO_STATE.mode === 'ONLINE' && UNO_NETWORK.mySeatIndex >= 0) {
          myPlayer = UNO_STATE.players[UNO_NETWORK.mySeatIndex];
        } else {
          myPlayer = UNO_STATE.players.find(p => !p.isAi);
        }
        if (myPlayer) callUno(myPlayer);
      };
    }

    // 抓漏按钮
    const catchBtn = document.getElementById('btn-catch-uno');
    if (catchBtn) {
      catchBtn.onclick = () => {
        let myPlayer;
        if (UNO_STATE.mode === 'ONLINE' && UNO_NETWORK.mySeatIndex >= 0) {
          myPlayer = UNO_STATE.players[UNO_NETWORK.mySeatIndex];
        } else {
          myPlayer = UNO_STATE.players.find(p => !p.isAi) || UNO_STATE.players[0];
        }
        if (myPlayer) catchUno(myPlayer);
      };
    }

    // 模式切换按钮
    const modeBtns = document.querySelectorAll('.uno-mode-btn');
    modeBtns.forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.mode === 'ONLINE') {
          openOnlineModal();
          return;
        }

        // 如果从 ONLINE 切换离开，断开连接
        if (UNO_STATE.mode === 'ONLINE') {
          UNO_NETWORK.disconnect();
        }

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

    // 初始化在线网络与大厅组件
    setupOnlineLobby();

    // 默认开启游戏 (单人模式)
    startUnoGame(true);
  });

  // 挂载至全局以供自动化测试调用
  window.UNO_ENGINE = {
    STATE: UNO_STATE,
    NETWORK: UNO_NETWORK,
    buildUnoDeck,
    shuffle,
    canPlayCard,
    getPlayableCards,
    startUnoGame,
    playCard,
    callUno,
    catchUno,
    aiPickDominantColor,
    buildInitialGameState
  };

})();
