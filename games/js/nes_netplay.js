/**
 * 🌐 FC/NES Netplay P2P 实时联机网络引擎
 * 协议栈架构：
 * 1. 信令层 (Signaling Plane)：基于 MQTT WebSocket 协议进行房间寻址与 SDP 握手
 * 2. 传输层 (Transport Plane)：WebRTC DataChannel 零中转 P2P 直连 (UDP / low-latency)
 * 3. 容灾降级 (Fault Tolerance)：WebRTC NAT 穿透受阻时无缝降级为 MQTT 中继传输
 */

class NesNetplay {
  constructor(options = {}) {
    this.role = 'solo'; // 'solo' | 'host' | 'guest'
    this.roomId = null;
    this.clientId = 'nes_' + Math.random().toString(36).substring(2, 9);
    
    this.mqttClient = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.isP2pConnected = false;
    this.isMqttConnected = false;
    this.lastPingTime = 0;
    this.latencyMs = 0;

    // Callbacks
    this.onRemoteInput = options.onRemoteInput || (() => {});
    this.onSyncRom = options.onSyncRom || (() => {});
    this.onCommand = options.onCommand || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onLatencyUpdate = options.onLatencyUpdate || (() => {});

    this.MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
    this.ICE_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ];
  }

  // --- 1. 房间生命周期控制 ---
  createRoom(initialRom) {
    this.role = 'host';
    this.roomId = Math.floor(1000 + Math.random() * 9000).toString();
    this.initMqttSignaling(this.roomId, initialRom);
    return this.roomId;
  }

  joinRoom(roomId) {
    if (!roomId) return;
    this.role = 'guest';
    this.roomId = roomId.trim();
    this.initMqttSignaling(this.roomId, null);
  }

  leaveRoom() {
    this.disconnect();
    this.role = 'solo';
    this.roomId = null;
    this.onStatusChange({ state: 'SOLO', text: '单机模式' });
  }

  // --- 2. MQTT 信令通道 ---
  initMqttSignaling(roomId, initialRom) {
    this.disconnect();

    if (typeof mqtt === 'undefined') {
      console.error('MQTT library not loaded');
      this.onStatusChange({ state: 'ERROR', text: 'MQTT 依赖库未就绪' });
      return;
    }

    this.onStatusChange({ 
      state: 'CONNECTING', 
      role: this.role, 
      roomId: roomId, 
      text: `正在连接联机大厅 (房间: ${roomId})...` 
    });

    try {
      this.mqttClient = mqtt.connect(this.MQTT_BROKER, {
        clientId: this.clientId,
        keepalive: 30,
        clean: true
      });

      const topic = `party_arcade_nes/room/${roomId}`;

      this.mqttClient.on('connect', () => {
        this.isMqttConnected = true;
        this.mqttClient.subscribe(topic, () => {
          if (this.role === 'host') {
            this.onStatusChange({ 
              state: 'WAITING', 
              role: 'host', 
              roomId: roomId, 
              text: `房间 [${roomId}] 已就绪，等待好友加入...` 
            });
          } else {
            // Guest sends JOIN
            this.sendMqttMessage({ type: 'GUEST_JOIN' });
            this.onStatusChange({ 
              state: 'JOINED', 
              role: 'guest', 
              roomId: roomId, 
              text: `已进入房间 [${roomId}]，等待房主同步画面...` 
            });
          }
        });
      });

      this.mqttClient.on('message', (t, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (msg.sender === this.clientId) return;
          this.handleIncomingMessage(msg, initialRom);
        } catch(e) {
          console.error('Signaling parse error:', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('MQTT Connection Error:', err);
        this.onStatusChange({ state: 'ERROR', text: '信令通道异常: ' + err.message });
      });

    } catch(err) {
      console.error(err);
      this.onStatusChange({ state: 'ERROR', text: '网络协议栈初始化失败' });
    }
  }

  sendMqttMessage(msg) {
    if (!this.mqttClient || !this.isMqttConnected || !this.roomId) return;
    msg.sender = this.clientId;
    const topic = `party_arcade_nes/room/${this.roomId}`;
    this.mqttClient.publish(topic, JSON.stringify(msg));
  }

  // --- 3. WebRTC DataChannel P2P 管道 ---
  async setupWebRtcHost() {
    this.cleanupPeerConnection();
    try {
      this.peerConnection = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });

      // Create high performance unordered UDP data channel
      this.dataChannel = this.peerConnection.createDataChannel('nes_netplay', {
        ordered: false,
        maxRetransmits: 0
      });
      this.bindDataChannelEvents(this.dataChannel);

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMqttMessage({ type: 'ICE_CANDIDATE', candidate: event.candidate });
        }
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.sendMqttMessage({ type: 'RTC_OFFER', sdp: this.peerConnection.localDescription });
    } catch(err) {
      console.warn('WebRTC Host Setup Failed, using MQTT fallback:', err);
    }
  }

  async setupWebRtcGuest(offerSdp) {
    this.cleanupPeerConnection();
    try {
      this.peerConnection = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });

      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.bindDataChannelEvents(this.dataChannel);
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendMqttMessage({ type: 'ICE_CANDIDATE', candidate: event.candidate });
        }
      };

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.sendMqttMessage({ type: 'RTC_ANSWER', sdp: this.peerConnection.localDescription });
    } catch(err) {
      console.warn('WebRTC Guest Setup Failed, using MQTT fallback:', err);
    }
  }

  bindDataChannelEvents(channel) {
    channel.onopen = () => {
      this.isP2pConnected = true;
      this.onStatusChange({ 
        state: 'CONNECTED_P2P', 
        role: this.role, 
        roomId: this.roomId, 
        text: '🚀 WebRTC P2P 直连通道已建立 (超低延迟)' 
      });
      this.startPingLoop();
    };

    channel.onclose = () => {
      this.isP2pConnected = false;
      this.onStatusChange({ 
        state: 'CONNECTED_MQTT', 
        role: this.role, 
        roomId: this.roomId, 
        text: '⚠️ P2P通道断开，已无缝降级为 MQTT 中继传输' 
      });
    };

    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.processPacket(msg);
      } catch(e) {
        console.error('DataChannel parse error:', e);
      }
    };
  }

  // --- 4. 报文路由总线 ---
  handleIncomingMessage(msg, initialRom) {
    if (msg.type === 'GUEST_JOIN' && this.role === 'host') {
      // 1. Sync current ROM with Guest
      if (initialRom) {
        this.sendMqttMessage({ type: 'SYNC_ROM', rom: initialRom });
      }
      // 2. Initiate WebRTC P2P Handshake
      this.setupWebRtcHost();
      this.onStatusChange({ 
        state: 'PEER_JOINED', 
        role: 'host', 
        roomId: this.roomId, 
        text: '🎉 好友已进入房间！正在建立 P2P 专属数据信道...' 
      });
    }
    else if (msg.type === 'SYNC_ROM') {
      this.onSyncRom(msg.rom);
    }
    else if (msg.type === 'RTC_OFFER' && this.role === 'guest') {
      this.setupWebRtcGuest(msg.sdp);
    }
    else if (msg.type === 'RTC_ANSWER' && this.role === 'host') {
      if (this.peerConnection) {
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(e => console.warn(e));
      }
    }
    else if (msg.type === 'ICE_CANDIDATE') {
      if (this.peerConnection) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(e => console.warn(e));
      }
    }
    else {
      // Game packets via MQTT fallback
      this.processPacket(msg);
    }
  }

  processPacket(msg) {
    if (msg.type === 'INPUT') {
      // msg: { type: 'INPUT', player: 1|2, btn: 'a'|'b'|'up'..., down: true|false }
      this.onRemoteInput(msg.player, msg.btn, msg.down);
    }
    else if (msg.type === 'CMD') {
      // msg: { type: 'CMD', action: 'save'|'load'|'reset'|'pause'..., payload: ... }
      this.onCommand(msg.action, msg.payload);
    }
    else if (msg.type === 'PING') {
      this.sendPacket({ type: 'PONG', t: msg.t });
    }
    else if (msg.type === 'PONG') {
      const rtt = Date.now() - msg.t;
      this.latencyMs = Math.round(rtt / 2);
      this.onLatencyUpdate(this.latencyMs, this.isP2pConnected ? 'P2P' : 'RELAY');
    }
  }

  // --- 5. 发送信令与输入报文 ---
  sendPacket(packet) {
    if (this.role === 'solo') return;

    // Prioritize WebRTC DataChannel (0ms network relay)
    if (this.isP2pConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(packet));
        return;
      } catch(e) {
        this.isP2pConnected = false;
      }
    }

    // Fallback: MQTT broker
    this.sendMqttMessage(packet);
  }

  sendInput(player, btn, isDown) {
    this.sendPacket({
      type: 'INPUT',
      player: player,
      btn: btn,
      down: isDown
    });
  }

  sendCommand(action, payload = null) {
    this.sendPacket({
      type: 'CMD',
      action: action,
      payload: payload
    });
  }

  broadcastRom(rom) {
    this.sendMqttMessage({
      type: 'SYNC_ROM',
      rom: rom
    });
  }

  startPingLoop() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.role !== 'solo') {
        this.sendPacket({ type: 'PING', t: Date.now() });
      }
    }, 2500);
  }

  cleanupPeerConnection() {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch(e) {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch(e) {}
      this.peerConnection = null;
    }
    this.isP2pConnected = false;
  }

  disconnect() {
    this.cleanupPeerConnection();
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.mqttClient) {
      try { this.mqttClient.end(); } catch(e) {}
      this.mqttClient = null;
    }
    this.isMqttConnected = false;
  }
}

window.NesNetplay = NesNetplay;
