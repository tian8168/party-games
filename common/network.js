/**
 * 🌐 聚会游戏大厅 · MQTT 异步联机中枢 (Online Multiplayer Network)
 * 基于公共 WebSocket MQTT Broker 实现轻量级去中心化房间协同。
 */

window.ONLINE_NETWORK = (function() {
  const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
  const myClientId = 'party_' + Math.random().toString(16).substr(2, 8);

  const state = {
    connected: false,
    roomId: null,
    myRole: 'host', // 'host' | 'guest'
    opponentJoined: false,
    mqttClient: null,
    onMessageCallback: null
  };

  function initMqtt(roomId, role, onMessage, currentGame) {
    if (state.mqttClient) {
      try { state.mqttClient.end(); } catch (e) {}
    }

    state.roomId = roomId;
    state.myRole = role;
    if (onMessage) state.onMessageCallback = onMessage;
    if (typeof state.onRoleChange === 'function') {
      state.onRoleChange(role);
    }

    const roomElem = document.getElementById('display-room-id');
    if (roomElem) roomElem.textContent = roomId;
    const roleElem = document.getElementById('display-role-info');
    if (roleElem) {
      roleElem.innerHTML = role === 'host' ? 
        '你是 <b style="color:var(--p1-color)">🔴 房主 (红方)</b>' : 
        '你是 <b style="color:var(--p2-color)">🟢 好友 (客方)</b>';
    }

    if (window.showToast) window.showToast(`正在连接房间 ${roomId}...`);
    const client = mqtt.connect(MQTT_BROKER, { clientId: myClientId, keepalive: 30, clean: true });
    state.mqttClient = client;

    client.on('connect', () => {
      state.connected = true;
      if (typeof state.onConnect === 'function') state.onConnect(roomId, role);
      const topic = `game_hall_v2/room/${roomId}`;
      client.subscribe(topic, () => {
        if (role === 'guest') {
          client.publish(topic, JSON.stringify({ type: 'JOIN', sender: myClientId, game: currentGame }));
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
              sendAction({ type: 'SYNC', game: currentGame });
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
    state.mqttClient.publish(`game_hall_v2/room/${state.roomId}`, JSON.stringify(data));
  }

  function createRoom(currentGame) {
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    initMqtt(roomId, 'host', state.onMessageCallback, currentGame);
    return roomId;
  }

  function copyLink() {
    if (!state.roomId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', state.roomId);
    url.searchParams.set('mode', 'ONLINE');
    navigator.clipboard.writeText(url.toString()).then(() => {
      if (window.showToast) window.showToast('📋 邀请链接已复制，发给微信/QQ好友即可！');
    }).catch(() => {
      if (window.showToast) window.showToast('复制失败，请手动分享房间号：' + state.roomId);
    });
  }

  function joinRoom(roomId, currentGame) {
    if (!roomId) {
      roomId = prompt('请输入4位房间号：');
    }
    if (roomId) {
      initMqtt(roomId.trim(), 'guest', state.onMessageCallback, currentGame);
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
