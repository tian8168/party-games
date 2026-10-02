/**
 * 🌐 聚会游戏大厅 · MQTT 异步联机中枢 (Online Multiplayer Network)
 * 基于公共 WebSocket MQTT Broker 实现轻量级去中心化房间协同。
 * 增强特性：
 * 1. 严格游戏命名空间隔离: game_hall_v2/${game.toLowerCase()}/room/${roomId}
 * 2. 6位数字随机房间号生成，杜绝全局房间号冲突与跨游戏串号
 */

window.ONLINE_NETWORK = (function() {
  const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
  const myClientId = 'party_' + Math.random().toString(16).substr(2, 8);

  const state = {
    connected: false,
    roomId: null,
    currentGame: null,
    myRole: 'host', // 'host' | 'guest'
    opponentJoined: false,
    mqttClient: null,
    onMessageCallback: null
  };

  function getTopic(game, roomId) {
    const g = (game || state.currentGame || (window.STATE && window.STATE.currentGame) || 'general').toLowerCase();
    const r = roomId || state.roomId;
    return `game_hall_v2/${g}/room/${r}`;
  }

  function initMqtt(roomId, role, onMessage, currentGame) {
    if (state.mqttClient) {
      try { state.mqttClient.end(); } catch (e) {}
    }

    state.roomId = roomId;
    state.currentGame = (currentGame || (window.STATE && window.STATE.currentGame) || 'general').toLowerCase();
    state.myRole = role;
    if (onMessage) state.onMessageCallback = onMessage;
    if (typeof state.onRoleChange === 'function') {
      state.onRoleChange(role);
    }

    const roomElem = document.getElementById('display-room-id');
    if (roomElem) roomElem.textContent = roomId;
    const roleElem = document.getElementById('display-role-info');
    if (roleElem) {
      if (state.currentGame === 'go' || state.currentGame === 'kaya') {
        roleElem.innerHTML = role === 'host' ? 
          '你是 <b style="color:#38bdf8">⚫ 房主 (执黑·先手)</b>' : 
          '你是 <b style="color:#f8fafc">⚪ 好友 (执白·后手)</b>';
      } else {
        roleElem.innerHTML = role === 'host' ? 
          '你是 <b style="color:var(--p1-color)">🔴 房主 (红方)</b>' : 
          '你是 <b style="color:var(--p2-color)">🟢 好友 (客方)</b>';
      }
    }

    if (window.showToast) window.showToast(`正在连接房间 ${roomId}...`);
    const client = mqtt.connect(MQTT_BROKER, { clientId: myClientId, keepalive: 30, clean: true });
    state.mqttClient = client;

    client.on('connect', () => {
      state.connected = true;
      if (typeof state.onConnect === 'function') state.onConnect(roomId, role);
      const topic = getTopic(state.currentGame, roomId);
      client.subscribe(topic, () => {
        if (role === 'guest') {
          client.publish(topic, JSON.stringify({ type: 'JOIN', sender: myClientId, game: state.currentGame }));
          if (window.showToast) window.showToast('已进入房间，正在等待同步...');
        } else {
          if (window.showToast) window.showToast('房间已就绪！点击复制链接发给好友');
        }
      });
    });

    client.on('message', (topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        if (msg.sender === myClientId) return;

        if (msg.type === 'JOIN') {
          if (state.myRole === 'host') {
            state.opponentJoined = true;
            if (window.showToast) window.showToast('🎉 好友已进入房间！对战正式开始！');
            if (typeof state.onOpponentJoined === 'function') {
              state.onOpponentJoined(msg);
            } else {
              sendAction({ type: 'SYNC', game: state.currentGame });
            }
          }
        }
        if (state.onMessageCallback) {
          state.onMessageCallback(msg);
        }
      } catch (e) {
        console.error('MQTT parse error:', e);
      }
    });

    client.on('error', (err) => {
      console.error('MQTT error:', err);
      if (window.showToast) window.showToast('网络连接异常');
    });
  }

  function sendAction(data) {
    if (!state.mqttClient || !state.connected) return;
    data.sender = myClientId;
    const topic = getTopic(state.currentGame, state.roomId);
    state.mqttClient.publish(topic, JSON.stringify(data));
  }

  function createRoom(currentGame) {
    const g = (currentGame || (window.STATE && window.STATE.currentGame) || 'general').toLowerCase();
    state.currentGame = g;
    // 6 位数字房间号生成机制 (100000 - 999999)，兼顾快捷输入与海量命名空间隔离
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    initMqtt(roomId, 'host', state.onMessageCallback, g);
    return roomId;
  }

  function copyLink() {
    if (!state.roomId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', state.roomId);
    url.searchParams.set('mode', 'ONLINE');
    if (state.currentGame) url.searchParams.set('game', state.currentGame);
    const textToCopy = url.toString();
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        if (window.showToast) window.showToast('📋 邀请链接已复制，发给微信/QQ好友即可！');
      } catch(e) {
        if (window.showToast) window.showToast('请手动分享房间号：' + state.roomId);
      }
      ta.remove();
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        if (window.showToast) window.showToast('📋 邀请链接已复制，发给微信/QQ好友即可！');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function joinRoom(roomId, currentGame) {
    const g = (currentGame || (window.STATE && window.STATE.currentGame) || 'general').toLowerCase();
    state.currentGame = g;
    if (!roomId) {
      roomId = prompt('请输入房间号：');
    }
    if (roomId) {
      initMqtt(roomId.trim(), 'guest', state.onMessageCallback, g);
    }
  }

  function setMessageHandler(cb) {
    state.onMessageCallback = cb;
  }

  function setRoleChangeHandler(cb) {
    state.onRoleChange = cb;
    if (state.myRole) cb(state.myRole);
  }

  function setOpponentJoinedHandler(cb) {
    state.onOpponentJoined = cb;
  }

  return {
    state,
    getTopic,
    initMqtt,
    sendAction,
    createRoom,
    copyLink,
    joinRoom,
    setMessageHandler,
    setRoleChangeHandler,
    setOpponentJoinedHandler
  };
})();
