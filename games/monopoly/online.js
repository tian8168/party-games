/**
 * 🌐 大富翁 (Monopoly) · 实时在线联机中枢 (Online Multiplayer Network)
 * 基于公共 WebSocket MQTT Broker 实现轻量级去中心化房间协同。
 * 支持 2-8 人在线对战，房主创建房间、6位数字房间号、链接分享、席位同步、
 * 掷骰同步、地产购买/盖楼/抵押/交易/破产协同与状态同步。
 */

window.MONOPOLY_ONLINE = (function() {
  const state = {
    isOnline: false,
    roomId: null,
    myRole: 'host', // 'host' | 'guest'
    mySlot: 1,      // 1..pcount
    myClientId: 'mono_' + Math.random().toString(16).substr(2, 8),
    connected: false,
    players: [],
    pcount: 4,
    gameStarted: false
  };

  const PLAYER_COLORS = [
    '#ff4757', // 红
    '#2ed573', // 绿
    '#38bdf8', // 蓝
    '#f59e0b', // 黄
    '#a855f7', // 紫
    '#ec4899', // 粉
    '#06b6d4', // 青
    '#84cc16'  // 柠檬绿
  ];

  function getNetwork() {
    return window.ONLINE_NETWORK || null;
  }

  function init() {
    const net = getNetwork();
    if (!net) return;

    net.setMessageHandler(handleNetworkMessage);

    // 检查 URL 参数是否带有房间号
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const modeParam = params.get('mode');

    if (roomParam || modeParam === 'ONLINE') {
      state.isOnline = true;
      if (typeof window.switchSetupMode === 'function') {
        window.switchSetupMode('ONLINE');
      }
      if (roomParam) {
        joinRoom(roomParam.trim());
      } else {
        createRoom(4);
      }
    }
  }

  function createRoom(targetPcount, hostName) {
    const net = getNetwork();
    if (!net) return null;

    state.isOnline = true;
    state.myRole = 'host';
    state.mySlot = 1;
    state.pcount = targetPcount || 4;
    state.gameStarted = false;

    // 生成 4 位随机房间号 (1000 - 9999) 满足极简输入与分享需求
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    net.initMqtt(roomId, 'host', handleNetworkMessage, 'monopoly');
    state.roomId = roomId;
    state.connected = true;

    // 初始化席位
    state.players = [];
    const nickInput = document.getElementById('online-nickname');
    const hName = hostName || (nickInput && nickInput.value ? nickInput.value.trim() : '') || '玩家 1 (房主)';
    state.players.push({
      slot: 1,
      id: state.myClientId,
      name: hName,
      color: PLAYER_COLORS[0],
      role: 'host',
      isAi: false,
      ready: true
    });

    for (let i = 2; i <= state.pcount; i++) {
      state.players.push({
        slot: i,
        id: null,
        name: '电脑 AI ' + i,
        color: PLAYER_COLORS[(i - 1) % PLAYER_COLORS.length],
        role: 'ai',
        isAi: true,
        ready: true
      });
    }

    updateLobbyUI();
    updateHeaderUI();
    return roomId;
  }

  function joinRoom(roomId, guestName) {
    const net = getNetwork();
    if (!net) return;

    if (!roomId) {
      roomId = prompt('请输入 4 位大富翁房间号:');
    }
    if (!roomId) return;

    roomId = roomId.trim();
    state.isOnline = true;
    state.myRole = 'guest';
    state.roomId = roomId;
    state.gameStarted = false;

    net.joinRoom(roomId, 'monopoly');

    const nickInput = document.getElementById('online-nickname');
    const gName = guestName || (nickInput && nickInput.value ? nickInput.value.trim() : '') || '玩家 ' + Math.floor(Math.random() * 900 + 100);

    // 订阅连接后发送 JOIN 消息
    setTimeout(() => {
      sendAction({
        type: 'MONO_JOIN',
        name: gName,
        clientId: state.myClientId
      });
    }, 600);

    updateHeaderUI();
  }

  function copyLink() {
    const net = getNetwork();
    if (net && typeof net.copyLink === 'function') {
      net.copyLink();
    } else if (state.roomId) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', state.roomId);
      url.searchParams.set('mode', 'ONLINE');
      navigator.clipboard.writeText(url.toString()).then(() => {
        alert('📋 邀请链接已复制，发给微信/QQ好友即可直接进入！');
      });
    }
  }

  function sendAction(data) {
    const net = getNetwork();
    if (!net || !state.isOnline) return;
    data.sender = state.myClientId;
    data.roomId = state.roomId;
    net.sendAction(data);
  }

  function handleNetworkMessage(msg) {
    if (!msg || !msg.type || msg.sender === state.myClientId) return;

    switch (msg.type) {
      case 'MONO_JOIN':
        handleGuestJoin(msg);
        break;
      case 'MONO_ROOM_STATE':
        handleRoomState(msg);
        break;
      case 'MONO_START_GAME':
        handleStartGame(msg);
        break;
      case 'MONO_ROLL':
        handleRemoteRoll(msg);
        break;
      case 'MONO_BUY':
        handleRemoteBuy(msg);
        break;
      case 'MONO_BUILD':
        handleRemoteBuild(msg);
        break;
      case 'MONO_SELL':
        handleRemoteSell(msg);
        break;
      case 'MONO_MORTGAGE':
        handleRemoteMortgage(msg);
        break;
      case 'MONO_BAIL':
        handleRemoteBail(msg);
        break;
      case 'MONO_END_TURN':
        handleRemoteEndTurn(msg);
        break;
      case 'MONO_RESIGN':
        handleRemoteResign(msg);
        break;
      case 'MONO_TRADE_PROPOSE':
        handleRemoteTradePropose(msg);
        break;
      case 'MONO_TRADE_RESP':
        handleRemoteTradeResp(msg);
        break;
      case 'MONO_CARD_DRAW':
        handleRemoteCardDraw(msg);
        break;
      case 'MONO_CARD_ACTION':
        handleRemoteCardAction(msg);
        break;
      case 'MONO_SYNC_STATE':
        handleRemoteSyncState(msg);
        break;
    }
  }

  function handleGuestJoin(msg) {
    if (state.myRole !== 'host') return;

    // 房主为新加入的玩家分配席位
    let assignedSlot = -1;
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].isAi || !state.players[i].id) {
        state.players[i].id = msg.clientId;
        state.players[i].name = msg.name || ('玩家 ' + (i + 1));
        state.players[i].isAi = false;
        state.players[i].role = 'guest';
        state.players[i].ready = true;
        assignedSlot = state.players[i].slot;
        break;
      }
    }

    if (assignedSlot === -1 && state.players.length < 8) {
      const slot = state.players.length + 1;
      state.players.push({
        slot: slot,
        id: msg.clientId,
        name: msg.name || ('玩家 ' + slot),
        color: PLAYER_COLORS[(slot - 1) % PLAYER_COLORS.length],
        role: 'guest',
        isAi: false,
        ready: true
      });
      state.pcount = state.players.length;
    }

    // 广播房间全量席位信息给所有人
    sendAction({
      type: 'MONO_ROOM_STATE',
      players: state.players,
      pcount: state.players.length,
      gameStarted: state.gameStarted
    });

    updateLobbyUI();
    if (window.showToast) window.showToast(`🎉 玩家【${msg.name}】已进入房间！`);
    if (window.AUDIO) window.AUDIO.play('click');
  }

  function handleRoomState(msg) {
    state.players = msg.players || [];
    state.pcount = msg.pcount || state.players.length;

    // 找到自己的席位编号
    const myEntry = state.players.find(p => p.id === state.myClientId);
    if (myEntry) {
      state.mySlot = myEntry.slot;
      state.myRole = myEntry.role;
    }

    updateLobbyUI();
    updateHeaderUI();

    if (msg.gameStarted && !state.gameStarted) {
      startMultiplayerGame(state.players, state.pcount);
    }
  }

  function startHostGame() {
    if (state.myRole !== 'host') return;

    state.gameStarted = true;
    sendAction({
      type: 'MONO_START_GAME',
      players: state.players,
      pcount: state.players.length
    });

    startMultiplayerGame(state.players, state.players.length);
  }

  function handleStartGame(msg) {
    state.players = msg.players;
    state.pcount = msg.pcount;
    state.gameStarted = true;
    startMultiplayerGame(msg.players, msg.pcount);
  }

  function startMultiplayerGame(playerList, count) {
    state.gameStarted = true;
    if (typeof window.startOnlineMonopolyGame === 'function') {
      window.startOnlineMonopolyGame(playerList, count);
    }
    updateHeaderUI();
    updateTurnControls();
  }

  // --- 动作网络同步 ---
  function broadcastRoll(die1, die2) {
    sendAction({
      type: 'MONO_ROLL',
      slot: window.turn,
      die1: die1,
      die2: die2
    });
  }

  function handleRemoteRoll(msg) {
    if (typeof window.executeOnlineRoll === 'function') {
      window.executeOnlineRoll(msg.die1, msg.die2);
    }
  }

  function broadcastBuy(propertyIndex) {
    sendAction({
      type: 'MONO_BUY',
      slot: window.turn,
      propertyIndex: propertyIndex
    });
  }

  function handleRemoteBuy(msg) {
    if (typeof window.executeOnlineBuy === 'function') {
      window.executeOnlineBuy(msg.propertyIndex);
    }
  }

  function broadcastBuild(propertyIndex) {
    sendAction({
      type: 'MONO_BUILD',
      slot: window.turn,
      propertyIndex: propertyIndex
    });
  }

  function handleRemoteBuild(msg) {
    if (typeof window.executeOnlineBuild === 'function') {
      window.executeOnlineBuild(msg.propertyIndex);
    }
  }

  function broadcastSell(propertyIndex) {
    sendAction({
      type: 'MONO_SELL',
      slot: window.turn,
      propertyIndex: propertyIndex
    });
  }

  function handleRemoteSell(msg) {
    if (typeof window.executeOnlineSell === 'function') {
      window.executeOnlineSell(msg.propertyIndex);
    }
  }

  function broadcastMortgage(propertyIndex, action) {
    sendAction({
      type: 'MONO_MORTGAGE',
      slot: window.turn,
      propertyIndex: propertyIndex,
      action: action
    });
  }

  function handleRemoteMortgage(msg) {
    if (typeof window.executeOnlineMortgage === 'function') {
      window.executeOnlineMortgage(msg.propertyIndex, msg.action);
    }
  }

  function broadcastBail(useCard) {
    sendAction({
      type: 'MONO_BAIL',
      slot: window.turn,
      useCard: !!useCard
    });
  }

  function handleRemoteBail(msg) {
    if (typeof window.executeOnlineBail === 'function') {
      window.executeOnlineBail(msg.useCard);
    }
  }

  function broadcastEndTurn() {
    sendAction({
      type: 'MONO_END_TURN',
      slot: window.turn
    });
  }

  function handleRemoteEndTurn(msg) {
    if (typeof window.executeOnlineEndTurn === 'function') {
      window.executeOnlineEndTurn();
    }
  }

  function broadcastResign() {
    sendAction({
      type: 'MONO_RESIGN',
      slot: window.turn
    });
  }

  function handleRemoteResign(msg) {
    if (typeof window.executeOnlineResign === 'function') {
      window.executeOnlineResign();
    }
  }

  function broadcastTradePropose(tradeData) {
    sendAction({
      type: 'MONO_TRADE_PROPOSE',
      trade: tradeData
    });
  }

  function handleRemoteTradePropose(msg) {
    if (typeof window.executeOnlineTradePropose === 'function') {
      window.executeOnlineTradePropose(msg.trade);
    }
  }

  function broadcastTradeResp(accept) {
    sendAction({
      type: 'MONO_TRADE_RESP',
      accept: accept
    });
  }

  function handleRemoteTradeResp(msg) {
    if (typeof window.executeOnlineTradeResp === 'function') {
      window.executeOnlineTradeResp(msg.accept);
    }
  }

  function broadcastCardDraw(deck, index) {
    sendAction({
      type: 'MONO_CARD_DRAW',
      slot: window.turn,
      deck: deck,
      index: index
    });
  }

  function handleRemoteCardDraw(msg) {
    if (typeof window.executeOnlineCardDraw === 'function') {
      window.executeOnlineCardDraw(msg.deck, msg.index);
    }
  }

  function broadcastCardAction(deck, index) {
    sendAction({
      type: 'MONO_CARD_ACTION',
      slot: window.turn,
      deck: deck,
      index: index
    });
  }

  function handleRemoteCardAction(msg) {
    if (typeof window.executeOnlineCardAction === 'function') {
      window.executeOnlineCardAction(msg.deck, msg.index);
    }
  }

  function broadcastSyncState() {
    if (state.myRole !== 'host' || !window.player || !window.square) return;
    const pData = [];
    for (let i = 1; i <= (window.pcount || 4); i++) {
      const p = window.player[i];
      if (p) {
        pData.push({
          index: i,
          money: p.money,
          position: p.position,
          jail: p.jail,
          jailroll: p.jailroll,
          communityChestJailCard: p.communityChestJailCard,
          chanceJailCard: p.chanceJailCard
        });
      }
    }
    const sData = [];
    for (let s = 0; s < 40; s++) {
      const sq = window.square[s];
      if (sq) {
        sData.push({
          index: s,
          owner: sq.owner,
          house: sq.house,
          hotel: sq.hotel,
          mortgage: sq.mortgage
        });
      }
    }
    sendAction({
      type: 'MONO_SYNC_STATE',
      turn: window.turn,
      doublecount: window.doublecount,
      pcount: window.pcount,
      players: pData,
      squares: sData
    });
  }

  function handleRemoteSyncState(msg) {
    if (state.myRole === 'host') return;
    if (typeof window.applyOnlineSyncState === 'function') {
      window.applyOnlineSyncState(msg);
    }
  }

  function handlePlayerEliminated(eliminatedSlot) {
    if (state.mySlot === eliminatedSlot) {
      state.myRole = 'spectator';
      if (window.showToast) window.showToast('你已破产出局，已转入观战席。');
    } else if (state.mySlot > eliminatedSlot) {
      state.mySlot--;
    }
    if (state.players && state.players.length > 0) {
      state.players.splice(eliminatedSlot - 1, 1);
      state.players.forEach((p, idx) => {
        p.slot = idx + 1;
      });
      state.pcount = state.players.length;
    }
    updateTurnControls();
    updateHeaderUI();
  }

  // --- UI 更新函数 ---
  function updateLobbyUI() {
    const listEl = document.getElementById('online-player-slots');
    if (!listEl) return;

    let html = '';
    state.players.forEach(p => {
      const isMe = p.slot === state.mySlot;
      const statusText = p.isAi ? '🤖 电脑 AI 替补' : (p.id ? (isMe ? '✨ 你 (当前客户端)' : '🟢 在线') : '⚪ 空闲');
      const badge = p.role === 'host' ? '👑 房主' : (p.isAi ? '🤖 电脑' : '👤 玩家');

      html += `
        <div class="online-slot-card ${isMe ? 'is-me' : ''}" style="border-left: 4px solid ${p.color};">
          <div class="slot-avatar" style="background-color: ${p.color};">
            ${p.slot}
          </div>
          <div class="slot-info">
            <div class="slot-name">${p.name} <span class="slot-badge">${badge}</span></div>
            <div class="slot-status">${statusText}</div>
          </div>
        </div>
      `;
    });
    listEl.innerHTML = html;

    const startBtn = document.getElementById('btn-online-start-game');
    if (startBtn) {
      startBtn.style.display = state.myRole === 'host' ? 'inline-flex' : 'none';
    }

    const roomNumEl = document.getElementById('online-room-code-display');
    if (roomNumEl) roomNumEl.textContent = state.roomId || '------';
  }

  function updateHeaderUI() {
    const headerRoom = document.getElementById('header-room-id');
    const headerMode = document.getElementById('header-mode-badge');
    if (headerRoom) {
      headerRoom.textContent = state.roomId ? ` (房号: ${state.roomId})` : '';
    }
    if (headerMode) {
      if (state.isOnline) {
        headerMode.textContent = `🌐 在线对战 (${state.myRole === 'host' ? '房主' : '玩家 ' + state.mySlot})`;
        headerMode.className = 'mode-badge badge-online';
      } else {
        headerMode.textContent = '🎮 本地对战';
        headerMode.className = 'mode-badge badge-local';
      }
    }
  }

  function updateTurnControls() {
    if (!state.isOnline || !state.gameStarted) return;
    const isMyTurn = (window.turn === state.mySlot);
    const curPlayer = window.player ? window.player[window.turn] : null;
    const isAi = curPlayer ? !curPlayer.human : false;
    const canControl = isMyTurn || (isAi && state.myRole === 'host');

    const nextBtn = document.getElementById('nextbutton');
    if (nextBtn) {
      if (canControl) {
        nextBtn.disabled = false;
        nextBtn.classList.remove('btn-disabled');
      } else {
        nextBtn.disabled = true;
        nextBtn.classList.add('btn-disabled');
        if (curPlayer) {
          nextBtn.value = `等待【${curPlayer.name}】操作...`;
        }
      }
    }

    const manageBtn = document.getElementById('btn-open-manage');
    const tradeBtn = document.getElementById('btn-open-trade');
    const resignBtn = document.getElementById('resignbutton');
    if (manageBtn) {
      manageBtn.disabled = !canControl;
      if (!canControl) manageBtn.classList.add('btn-disabled');
      else manageBtn.classList.remove('btn-disabled');
    }
    if (tradeBtn) {
      tradeBtn.disabled = !canControl;
      if (!canControl) tradeBtn.classList.add('btn-disabled');
      else tradeBtn.classList.remove('btn-disabled');
    }
    if (resignBtn) {
      resignBtn.disabled = !isMyTurn;
      if (!isMyTurn) resignBtn.classList.add('btn-disabled');
      else resignBtn.classList.remove('btn-disabled');
    }
  }

  return {
    state,
    init,
    createRoom,
    joinRoom,
    copyLink,
    startHostGame,
    broadcastRoll,
    broadcastBuy,
    broadcastBuild,
    broadcastSell,
    broadcastMortgage,
    broadcastBail,
    broadcastEndTurn,
    broadcastResign,
    broadcastTradePropose,
    broadcastTradeResp,
    broadcastCardDraw,
    broadcastCardAction,
    broadcastSyncState,
    handlePlayerEliminated,
    updateLobbyUI,
    updateHeaderUI,
    updateTurnControls
  };
})();
