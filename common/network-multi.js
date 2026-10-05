/**
 * 🌐 聚会游戏大厅 · 多人在线联机中枢 (Multiplayer Online Network Framework)
 * 
 * 核心特性：
 * 1. 零服务器依赖：基于公共 WebSocket MQTT Broker 实现 Serverless 去中心化多端协同。
 * 2. 房主权威仲裁模型 (Host-Authoritative Snapshot Protocol)：
 *    - 房主 (Seat 1) 作为房间权威节点，负责洗牌、发牌、规则校验与状态广播；
 *    - 客方 (Seat 2..N) 通过 ACTION 上报意图，依房主广播的权威快照做确定性渲染；
 *    - 支持离线/空缺席位填充本地智能 AI；
 *    - 支持断线重连一键全量快照恢复 (Full Snapshot Resync)。
 * 3. 4 位数字极简房间号 (1000 - 9999)，一键剪贴板分享，支持微信/移动端 URL 直达。
 * 4. 移动端落地页防误退保护 (Landing Page History Guard)：分享链接进入时拦截物理返回键，平滑回退大厅。
 */

(function(window) {
  'use strict';

  const DEFAULT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

  class MultiPlayerNetwork {
    constructor(options = {}) {
      this.game = (options.game || 'general').toLowerCase();
      this.maxPlayers = options.maxPlayers || 4;
      this.minPlayers = options.minPlayers || 2;
      this.playerColors = options.playerColors || [
        '#ef4444', // P1 红
        '#3b82f6', // P2 蓝
        '#10b981', // P3 绿
        '#f59e0b', // P4 黄
        '#8b5cf6', // P5 紫
        '#ec4899', // P6 粉
        '#06b6d4', // P7 青
        '#84cc16'  // P8 柠檬绿
      ];

      this.callbacks = {
        onConnect: options.onConnect || null,
        onSeatUpdate: options.onSeatUpdate || null,
        onGameStart: options.onGameStart || null,
        onAction: options.onAction || null,         // 房主接收客方指令
        onStateSync: options.onStateSync || null,   // 客方接收权威状态
        onMessage: options.onMessage || null,       // 自定义消息处理
        onPlayerLeave: options.onPlayerLeave || null,
        onStatusChange: options.onStatusChange || null
      };

      this.clientId = 'mp_' + Math.random().toString(16).substring(2, 10);
      this.roomId = null;
      this.myRole = 'host'; // 'host' | 'guest'
      this.mySlot = 1;      // 1..maxPlayers
      this.myName = options.defaultName || '玩家 1';
      this.connected = false;
      this.gameStarted = false;
      this.mqttClient = null;

      // 席位信息
      this.seats = [];
      this._initDefaultSeats();

      // 落地页导航保护
      this.setupHistoryGuard();
    }

    _initDefaultSeats() {
      this.seats = [];
      for (let i = 1; i <= this.maxPlayers; i++) {
        this.seats.push({
          slot: i,
          id: i === 1 ? this.clientId : null,
          name: i === 1 ? this.myName : `电脑 AI ${i}`,
          color: this.playerColors[(i - 1) % this.playerColors.length],
          role: i === 1 ? 'host' : 'ai',
          isAi: i !== 1,
          ready: true,
          online: i === 1
        });
      }
    }

    getTopic(roomId) {
      const r = roomId || this.roomId;
      return `game_hall_v2/${this.game}/room/${r}`;
    }

    /**
     * 创建房间 (房主发起)
     */
    createRoom(targetCount, hostName) {
      if (typeof mqtt === 'undefined') {
        console.error('[MultiNetwork] MQTT library not loaded');
        if (window.showToast) window.showToast('⚠️ 网络组件未就绪，请刷新重试');
        return null;
      }

      this.disconnect();

      this.maxPlayers = targetCount || this.maxPlayers;
      this.myRole = 'host';
      this.mySlot = 1;
      this.gameStarted = false;
      if (hostName) this.myName = hostName;

      // 生成 4 位数字房间号
      this.roomId = Math.floor(1000 + Math.random() * 9000).toString();

      this._initDefaultSeats();
      this.seats[0].name = this.myName;
      this.seats[0].id = this.clientId;
      this.seats[0].role = 'host';
      this.seats[0].isAi = false;
      this.seats[0].ready = true;
      this.seats[0].online = true;

      this._connectMqtt(() => {
        if (window.showToast) window.showToast(`🎉 房间 [${this.roomId}] 已创建，等待好友加入！`);
        this._notifySeatUpdate();
      });

      return this.roomId;
    }

    /**
     * 加入房间 (客方发起)
     */
    joinRoom(roomId, guestName) {
      if (typeof mqtt === 'undefined') {
        console.error('[MultiNetwork] MQTT library not loaded');
        if (window.showToast) window.showToast('⚠️ 网络组件未就绪，请刷新重试');
        return;
      }

      if (!roomId) return;
      roomId = roomId.toString().trim();

      this.disconnect();

      this.roomId = roomId;
      this.myRole = 'guest';
      this.gameStarted = false;
      if (guestName) this.myName = guestName;

      this._connectMqtt(() => {
        if (window.showToast) window.showToast(`已进入房间 [${roomId}]，正在申请席位...`);
        // 发送加入申请
        setTimeout(() => {
          this.sendMessage({
            type: 'MP_JOIN',
            name: this.myName,
            clientId: this.clientId
          });
        }, 300);
      });
    }

    _connectMqtt(onConnectedCallback) {
      if (this.mqttClient) {
        try { this.mqttClient.end(true); } catch (e) {}
      }

      const client = mqtt.connect(DEFAULT_BROKER, {
        clientId: this.clientId,
        keepalive: 30,
        clean: true,
        connectTimeout: 8000
      });
      this.mqttClient = client;

      client.on('connect', () => {
        this.connected = true;
        const topic = this.getTopic();
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            console.error('[MultiNetwork] Subscribe error:', err);
          } else {
            if (this.callbacks.onConnect) this.callbacks.onConnect(this.roomId, this.myRole);
            if (onConnectedCallback) onConnectedCallback();
          }
        });
      });

      client.on('message', (topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (msg.sender === this.clientId) return; // 忽略自己发出的广播
          this._handleIncomingMessage(msg);
        } catch (e) {
          console.error('[MultiNetwork] Parse error:', e);
        }
      });

      client.on('error', (err) => {
        console.warn('[MultiNetwork] MQTT error:', err);
      });

      client.on('close', () => {
        this.connected = false;
      });
    }

    _handleIncomingMessage(msg) {
      if (!msg || !msg.type) return;

      // 通用消息回调
      if (this.callbacks.onMessage) {
        this.callbacks.onMessage(msg);
      }

      switch (msg.type) {
        case 'MP_JOIN':
          if (this.myRole === 'host') {
            this._handleHostReceiveJoin(msg);
          }
          break;

        case 'MP_SEAT_SYNC':
          this._handleReceiveSeatSync(msg);
          break;

        case 'MP_READY_TOGGLE':
          if (this.myRole === 'host') {
            this._handleHostReceiveReadyToggle(msg);
          }
          break;

        case 'MP_START_GAME':
          this.gameStarted = true;
          if (this.callbacks.onGameStart) {
            this.callbacks.onGameStart(msg.initialState);
          }
          break;

        case 'MP_ACTION':
          if (this.myRole === 'host') {
            if (this.callbacks.onAction) {
              this.callbacks.onAction(msg.action, msg.slot, msg.sender);
            }
          }
          break;

        case 'MP_STATE_SYNC':
          if (this.callbacks.onStateSync) {
            this.callbacks.onStateSync(msg.state);
          }
          break;

        case 'MP_SYNC_REQ':
          if (this.myRole === 'host') {
            // 客方请求全量恢复
            if (this._lastAuthorityState) {
              this.broadcastState(this._lastAuthorityState);
            }
          }
          break;

        case 'MP_LEAVE':
          this._handlePlayerLeave(msg);
          break;
      }
    }

    _handleHostReceiveJoin(msg) {
      // 检查该玩家是否已在房间（重连）
      let existingSeat = this.seats.find(s => s.id === msg.clientId);
      if (existingSeat) {
        existingSeat.name = msg.name || existingSeat.name;
        existingSeat.online = true;
        this.broadcastSeats();
        return;
      }

      // 寻找空闲或 AI 席位分配给新玩家
      let availableSeat = this.seats.find(s => s.isAi || !s.online);
      if (!availableSeat) {
        // 房间已满
        this.sendMessage({
          type: 'MP_ROOM_FULL',
          target: msg.clientId
        });
        return;
      }

      availableSeat.id = msg.clientId;
      availableSeat.name = msg.name || `玩家 ${availableSeat.slot}`;
      availableSeat.role = 'guest';
      availableSeat.isAi = false;
      availableSeat.ready = true;
      availableSeat.online = true;

      if (window.showToast) {
        window.showToast(`🎉 [${availableSeat.name}] 进入了房间 (席位 ${availableSeat.slot})！`);
      }

      this.broadcastSeats();
    }

    _handleReceiveSeatSync(msg) {
      if (!msg.seats) return;
      this.seats = msg.seats;
      this.maxPlayers = msg.seats.length;

      // 确定我自己的席位
      const mySeat = this.seats.find(s => s.id === this.clientId);
      if (mySeat) {
        this.mySlot = mySeat.slot;
      }

      this._notifySeatUpdate();
    }

    _handleHostReceiveReadyToggle(msg) {
      const seat = this.seats.find(s => s.slot === msg.slot && s.id === msg.sender);
      if (seat) {
        seat.ready = !!msg.ready;
        this.broadcastSeats();
      }
    }

    _handlePlayerLeave(msg) {
      const seat = this.seats.find(s => s.slot === msg.slot);
      if (seat) {
        seat.online = false;
        seat.isAi = true;
        seat.role = 'ai';
        seat.name = `电脑 AI ${seat.slot}`;
        seat.id = null;
        if (window.showToast) window.showToast(`玩家 [席位 ${msg.slot}] 已退出`);
        if (this.myRole === 'host') this.broadcastSeats();
        if (this.callbacks.onPlayerLeave) this.callbacks.onPlayerLeave(msg.slot);
      }
    }

    _notifySeatUpdate() {
      if (this.callbacks.onSeatUpdate) {
        this.callbacks.onSeatUpdate(this.seats, this.mySlot);
      }
    }

    /**
     * 房主广播最新席位信息
     */
    broadcastSeats() {
      if (this.myRole !== 'host') return;
      this.sendMessage({
        type: 'MP_SEAT_SYNC',
        seats: this.seats
      });
      this._notifySeatUpdate();
    }

    /**
     * 房主切换指定席位属性 (如在 AI / 玩家之间切换，或踢出)
     */
    toggleSeatAi(slot) {
      if (this.myRole !== 'host' || slot === 1) return;
      const target = this.seats.find(s => s.slot === slot);
      if (!target) return;

      if (!target.isAi && target.online) {
        // 踢出真人并替换为 AI
        target.isAi = true;
        target.role = 'ai';
        target.name = `电脑 AI ${slot}`;
        target.id = null;
        target.ready = true;
      } else {
        // AI 席位开放或保持
        target.isAi = true;
        target.role = 'ai';
        target.name = `电脑 AI ${slot}`;
        target.ready = true;
      }
      this.broadcastSeats();
    }

    /**
     * 房主宣布游戏正式开始
     */
    startGame(initialState = {}) {
      if (this.myRole !== 'host') return;
      this.gameStarted = true;
      this._lastAuthorityState = initialState;
      this.sendMessage({
        type: 'MP_START_GAME',
        initialState: initialState
      });
      if (this.callbacks.onGameStart) {
        this.callbacks.onGameStart(initialState);
      }
    }

    /**
     * 客方发送玩家操作给房主
     */
    sendAction(action) {
      if (!this.connected) return;
      this.sendMessage({
        type: 'MP_ACTION',
        slot: this.mySlot,
        action: action
      });
    }

    /**
     * 房主向全员广播权威游戏状态快照 (Authoritative State Snapshot)
     */
    broadcastState(state) {
      if (this.myRole !== 'host') return;
      this._lastAuthorityState = state;
      this.sendMessage({
        type: 'MP_STATE_SYNC',
        state: state
      });
      // 房主本地同步
      if (this.callbacks.onStateSync) {
        this.callbacks.onStateSync(state);
      }
    }

    /**
     * 客方请求全量状态补发
     */
    requestStateSync() {
      if (this.myRole !== 'guest') return;
      this.sendMessage({
        type: 'MP_SYNC_REQ',
        slot: this.mySlot
      });
    }

    /**
     * 发送底层消息包
     */
    sendMessage(data) {
      if (!this.mqttClient || !this.connected) return;
      data.sender = this.clientId;
      data.roomId = this.roomId;
      data.game = this.game;
      data.timestamp = Date.now();
      const topic = this.getTopic();
      try {
        this.mqttClient.publish(topic, JSON.stringify(data));
      } catch (e) {
        console.error('[MultiNetwork] Send error:', e);
      }
    }

    /**
     * 生成分享 URL 并复制至剪贴板
     */
    copyShareLink() {
      if (!this.roomId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.roomId);
      url.searchParams.set('mode', 'ONLINE');
      const shareUrl = url.toString();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          if (window.showToast) window.showToast('📋 邀请链接已复制！发给好友点击即可加入');
        }).catch(() => {
          this._fallbackCopy(shareUrl);
        });
      } else {
        this._fallbackCopy(shareUrl);
      }
    }

    _fallbackCopy(text) {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        if (window.showToast) window.showToast('📋 邀请链接已复制！');
      } catch (e) {
        prompt('请长按复制房间邀请链接:', text);
      }
      document.body.removeChild(input);
    }

    /**
     * 断开连接
     */
    disconnect() {
      if (this.connected && this.roomId) {
        try {
          this.sendMessage({
            type: 'MP_LEAVE',
            slot: this.mySlot
          });
        } catch (e) {}
      }
      if (this.mqttClient) {
        try { this.mqttClient.end(true); } catch (e) {}
        this.mqttClient = null;
      }
      this.connected = false;
      this.roomId = null;
      this.gameStarted = false;
    }

    /**
     * 🛡️ 移动端与微信浏览器落地页防误退保护 (Landing Page History Guard)
     * 解决微信/移动端打开好友分享链接后，点击物理返回直接关掉整个网页的严重痛点。
     */
    setupHistoryGuard(lobbyUrl = '../index.html') {
      try {
        // 若当前处于落地页（无上一页历史或从外部打开）
        if (window.history.length <= 2 || !document.referrer) {
          const currentUrl = window.location.href;
          window.history.replaceState({ page: 'lobby' }, '', lobbyUrl);
          window.history.pushState({ page: 'game' }, '', currentUrl);

          window.addEventListener('popstate', (e) => {
            if (!e.state || e.state.page === 'lobby') {
              window.location.href = lobbyUrl;
            }
          });
        }
      } catch (e) {
        // 静默保护
      }
    }

    /**
     * 快速检查 URL 参数是否携带房间号
     */
    static checkUrlRoom() {
      const params = new URLSearchParams(window.location.search);
      return {
        room: params.get('room'),
        mode: params.get('mode')
      };
    }
  }

  // 挂载全局
  window.MultiPlayerNetwork = MultiPlayerNetwork;

})(typeof window !== 'undefined' ? window : this);
