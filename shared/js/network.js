// ==========================================================================
// 聚会游戏大厅 · MQTT 在线联机通信中枢 (Shared Network Module)
// ==========================================================================
const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
let myClientId = 'client_' + Math.random().toString(36).substring(2, 9);

function initMqtt(roomId, role) {
  if (window.STATE && window.STATE.online && window.STATE.online.mqttClient) {
    try { window.STATE.online.mqttClient.end(); } catch (e) {}
  }

  if (window.STATE && window.STATE.online) {
    window.STATE.online.roomId = roomId;
    window.STATE.online.myRole = role;
  }

  const roomIdEl = document.getElementById('display-room-id');
  if (roomIdEl) roomIdEl.textContent = roomId;
  const roleEl = document.getElementById('display-role-info');
  if (roleEl) {
    roleEl.innerHTML = role === 'host' ? 
      '你是 <b style="color:var(--p1-color)">🔴 房主 (红方)</b>' : 
      '你是 <b style="color:var(--p2-color)">🟢 好友 (客方)</b>';
  }

  showToast(`正在连接房间 ${roomId}...`);
  const client = mqtt.connect(MQTT_BROKER, { clientId: myClientId, keepalive: 30, clean: true });
  if (window.STATE && window.STATE.online) {
    window.STATE.online.mqttClient = client;
  }

  client.on('connect', () => {
    if (window.STATE && window.STATE.online) {
      window.STATE.online.connected = true;
    }
    const topic = `game_hall_v2/room/${roomId}`;
    client.subscribe(topic, () => {
      if (role === 'guest') {
        const curG = window.STATE ? window.STATE.currentGame : '';
        client.publish(topic, JSON.stringify({ type: 'JOIN', sender: myClientId, game: curG }));
        showToast('已进入房间，正在等待同步...');
      } else {
        showToast('房间已就绪！点击复制链接发给好友');
      }
    });
  });

  client.on('message', (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.sender === myClientId) return;

      if (msg.type === 'JOIN') {
        if (window.STATE && window.STATE.online && window.STATE.online.myRole === 'host') {
          window.STATE.online.opponentJoined = true;
          showToast('🎉 好友已进入房间！对战正式开始！');
          sendOnlineAction({ type: 'SYNC', game: window.STATE.currentGame, turn: window.STATE.turn });
          if (typeof updateScoreboard === 'function') updateScoreboard();
        }
      } else if (msg.type === 'SYNC') {
        if (window.STATE && window.STATE.online && window.STATE.online.myRole === 'guest') {
          window.STATE.online.opponentJoined = true;
          showToast('🎮 同步成功，对战开始！');
          if (typeof updateScoreboard === 'function') updateScoreboard();
        }
      } else if (msg.type === 'RESTART') {
        if (typeof resetCurrentGame === 'function') resetCurrentGame();
        showToast('🔄 对方重新开始了对局！');
      } else {
        if (typeof handleGameOnlineAction === 'function') {
          handleGameOnlineAction(msg);
        }
      }
    } catch (e) {
      console.error('MQTT message error:', e);
    }
  });
}

function sendOnlineAction(data) {
  if (!window.STATE || !window.STATE.online || !window.STATE.online.mqttClient || !window.STATE.online.connected) return;
  data.sender = myClientId;
  data.game = window.STATE.currentGame;
  window.STATE.online.mqttClient.publish(`game_hall_v2/room/${window.STATE.online.roomId}`, JSON.stringify(data));
}

function createOnlineRoom() {
  AUDIO.play('click');
  const roomId = Math.floor(100000 + Math.random() * 900000).toString();
  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${roomId}`;
  window.history.replaceState({ path: newUrl }, '', newUrl);

  const btnCreate = document.getElementById('btn-create-room');
  if (btnCreate) btnCreate.style.display = 'none';
  const btnShare = document.getElementById('btn-share-link');
  if (btnShare) btnShare.style.display = 'flex';
  if (typeof resetCurrentGame === 'function') resetCurrentGame();
  initMqtt(roomId, 'host');
}

function copyInviteLink() {
  AUDIO.play('click');
  const roomId = (window.STATE && window.STATE.online) ? window.STATE.online.roomId : '';
  const url = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${roomId}`;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(() => showToast('✅ 邀请链接已复制！快发给微信好友吧！'));
  } else {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('✅ 邀请链接已复制！快发给微信好友吧！');
  }
}

function promptJoinRoom() {
  AUDIO.play('click');
  const id = prompt('请输入好友分享的 6 位房间号：');
  if (id && id.trim()) {
    const cleanId = id.trim();
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${cleanId}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
    joinExistingRoom(cleanId);
  }
}

function joinExistingRoom(roomId) {
  const btnCreate = document.getElementById('btn-create-room');
  if (btnCreate) btnCreate.style.display = 'none';
  const btnShare = document.getElementById('btn-share-link');
  if (btnShare) btnShare.style.display = 'none';
  if (typeof resetCurrentGame === 'function') resetCurrentGame();
  initMqtt(roomId, 'guest');
}
