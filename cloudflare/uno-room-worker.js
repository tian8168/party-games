/**
 * ============================================================================
 * 🌈 彩虹乌诺牌 · 专用 Cloudflare Worker 联机对战中枢 (UNO Multiplayer Hub)
 * ============================================================================
 * 
 * 架构特性：
 * 1. 零依赖原生 WebSockets: 基于 Cloudflare Worker WebSocketPair 架构，无需 npm 安装任何包。
 * 2. 6位房间号分流机制: 支持多组玩家同时开房对战 (1-4人/房)，自动分配 4 大专属席位 (🔴P1, 🟢P2, 🔵P3, 🟡P4)。
 * 3. 房主权威同步 & 断线平滑转移: 房主控制洗牌发牌与游戏节奏，房主断线自动顺延席位继承房主权。
 * 4. 心跳保活与自动清理: 内置 Ping/Pong 探测与空房间自动垃圾回收。
 * 5. 开箱即用: 支持一键部署到 Cloudflare 免费版 Workers (每月免费 100,000 请求，并发 WebSockets 极速稳定)。
 * 
 * ============================================================================
 * 部署指南 (DEPLOYMENT GUIDE - 仅需 1 分钟):
 * 
 * 方法一：Cloudflare Dashboard 网页端无代码极速部署 (推荐)
 * 1. 登录 https://dash.cloudflare.com/
 * 2. 侧边栏进入「Workers 和 Pages」-> 点击「创建应用程序 (Create Application)」-> 选择「创建 Worker」
 * 3. 输入 Worker 名称 (如: party-uno)，点击「部署 (Deploy)」
 * 4. 部署成功后，点击「编辑代码 (Quick Edit)」
 * 5. 将本文件的全部代码复制并覆盖粘贴进去，点击「保存并部署 (Save and Deploy)」
 * 6. 复制分配的域名 (例如: party-uno.your-subdomain.workers.dev)
 * 7. 打开游戏网页，点击「🌐 在线联机」->「服务器设置」，填入你的 Worker 域名即可！
 * 
 * 方法二：使用 Wrangler 命令行部署
 *   npx wrangler deploy cloudflare/uno-room-worker.js --name party-uno
 * ============================================================================
 */

// 内存中维护的房间注册表
// Map<roomId, RoomState>
const rooms = new Map();

// 席位常量配置
const MAX_SEATS = 4;
const SEAT_COLORS = ['RED', 'GREEN', 'BLUE', 'YELLOW'];

/**
 * 获取或创建房间
 */
function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      createdAt: Date.now(),
      hostId: null,
      seats: [null, null, null, null], // 4 个席位
      houseRules: {
        stacking: true, // 允许 +2/+4 连环叠牌
        fillAi: true    // 允许空位填充 AI
      },
      gameStarted: false,
      lastActive: Date.now()
    };
    rooms.set(roomId, room);
  }
  return room;
}

/**
 * 广播消息给房间内的所有玩家
 */
function broadcastToRoom(room, message, excludeWs = null) {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  room.seats.forEach(slot => {
    if (slot && slot.ws && slot.ws !== excludeWs) {
      try {
        slot.ws.send(payload);
      } catch (err) {
        console.error(`[Worker] Send failed to seat ${slot.seatIndex}:`, err);
      }
    }
  });
}

/**
 * 序列化房间当前状态给客户端
 */
function serializeRoom(room, forClientId = null) {
  return {
    type: 'ROOM_UPDATE',
    roomId: room.id,
    gameStarted: room.gameStarted,
    houseRules: room.houseRules,
    hostId: room.hostId,
    players: room.seats.map((s, idx) => {
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        seatIndex: idx,
        isHost: s.id === room.hostId,
        colorKey: SEAT_COLORS[idx],
        joinedAt: s.joinedAt
      };
    }),
    mySeatIndex: forClientId ? room.seats.findIndex(s => s && s.id === forClientId) : -1
  };
}

/**
 * 处理单条 WebSocket 连接生命周期
 */
function handleSession(serverWs, params) {
  const { roomId, playerName, clientId, isCreate } = params;
  let currentRoom = null;
  let mySeatIndex = -1;

  // 1. 加入或创建房间
  currentRoom = getOrCreateRoom(roomId);
  currentRoom.lastActive = Date.now();

  // 检查是否为断线重连
  const existingSeatIndex = currentRoom.seats.findIndex(s => s && s.id === clientId);

  if (existingSeatIndex !== -1) {
    // 重连已有席位
    mySeatIndex = existingSeatIndex;
    currentRoom.seats[mySeatIndex].ws = serverWs;
    currentRoom.seats[mySeatIndex].name = playerName || currentRoom.seats[mySeatIndex].name;
    console.log(`[Worker] Client ${clientId} reconnected to room ${roomId} seat ${mySeatIndex}`);
  } else {
    // 分配新席位
    const freeIndex = currentRoom.seats.findIndex(s => s === null);
    if (freeIndex === -1) {
      // 房间已满
      serverWs.send(JSON.stringify({
        type: 'ERROR',
        code: 'ROOM_FULL',
        message: '该房间席位已满 (最多4人)，请更换房间或新建对局！'
      }));
      serverWs.close(1008, 'Room is full');
      return;
    }

    mySeatIndex = freeIndex;
    const isFirstPlayer = (currentRoom.hostId === null) || isCreate || (mySeatIndex === 0 && !currentRoom.hostId);
    if (isFirstPlayer || !currentRoom.hostId) {
      currentRoom.hostId = clientId;
    }

    currentRoom.seats[mySeatIndex] = {
      id: clientId,
      name: playerName || `玩家 ${mySeatIndex + 1}`,
      seatIndex: mySeatIndex,
      ws: serverWs,
      joinedAt: Date.now()
    };
    console.log(`[Worker] Client ${clientId} joined room ${roomId} at seat ${mySeatIndex} (host: ${currentRoom.hostId === clientId})`);
  }

  // 2. 发送初次加入欢迎信息
  serverWs.send(JSON.stringify({
    type: 'JOINED_SUCCESS',
    roomId: currentRoom.id,
    mySeatIndex: mySeatIndex,
    isHost: currentRoom.hostId === clientId,
    roomData: serializeRoom(currentRoom, clientId)
  }));

  // 3. 广播给房间其他玩家
  broadcastToRoom(currentRoom, serializeRoom(currentRoom), serverWs);

  // 4. 监听客户端消息
  serverWs.addEventListener('message', event => {
    try {
      currentRoom.lastActive = Date.now();
      const data = JSON.parse(event.data);

      switch (data.type) {
        // 心跳 Ping
        case 'PING':
          serverWs.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
          break;

        // 房主更新房规 (叠牌 / AI填补等)
        case 'UPDATE_RULES':
          if (currentRoom.hostId === clientId && data.rules) {
            currentRoom.houseRules = { ...currentRoom.houseRules, ...data.rules };
            broadcastToRoom(currentRoom, {
              type: 'RULES_UPDATED',
              rules: currentRoom.houseRules
            });
          }
          break;

        // 房主触发游戏开始
        case 'START_GAME':
          if (currentRoom.hostId === clientId) {
            currentRoom.gameStarted = true;
            // 广播游戏开始事件，携带首发牌堆、席位分配与开局参数
            broadcastToRoom(currentRoom, {
              type: 'GAME_START',
              roomId: currentRoom.id,
              initialState: data.initialState,
              players: currentRoom.seats.map((s, idx) => {
                if (s) {
                  return {
                    id: s.id,
                    name: s.name,
                    seatIndex: idx,
                    isAi: false,
                    isHost: s.id === currentRoom.hostId
                  };
                }
                return {
                  id: `ai_${idx + 1}`,
                  name: `🤖 智子 ${idx + 1} (AI)`,
                  seatIndex: idx,
                  isAi: true,
                  isHost: false
                };
              })
            });
          }
          break;

        // 核心出牌与回合动作转发 (Relay Action)
        case 'GAME_ACTION':
          // 转发给房间其他玩家 (也可以带上发送者席位校验)
          broadcastToRoom(currentRoom, {
            type: 'GAME_ACTION',
            seatIndex: mySeatIndex,
            action: data.action,
            payload: data.payload,
            syncId: data.syncId || Date.now()
          }, serverWs); // excludeWs: 不回显给发送者自身，客户端可即时乐观渲染
          break;

        // 房主全量状态快照同步 (防止极端网络丢包造成的不同步)
        case 'HOST_STATE_SYNC':
          if (currentRoom.hostId === clientId) {
            broadcastToRoom(currentRoom, {
              type: 'HOST_STATE_SYNC',
              snapshot: data.snapshot
            }, serverWs);
          }
          break;

        // 聊天互动与表情气泡
        case 'CHAT':
          broadcastToRoom(currentRoom, {
            type: 'CHAT',
            seatIndex: mySeatIndex,
            senderName: currentRoom.seats[mySeatIndex]?.name || '玩家',
            text: data.text,
            time: Date.now()
          });
          break;

        default:
          console.warn(`[Worker] Unhandled message type: ${data.type}`);
          break;
      }
    } catch (err) {
      console.error('[Worker] Error processing message:', err);
    }
  });

  // 5. 监听断开连接事件
  const handleDisconnect = () => {
    console.log(`[Worker] Seat ${mySeatIndex} disconnected from room ${roomId}`);
    if (currentRoom && currentRoom.seats[mySeatIndex]) {
      // 清空该席位
      currentRoom.seats[mySeatIndex] = null;

      // 如果房主离开了，自动将房主转移给下一个在座玩家
      if (currentRoom.hostId === clientId) {
        const nextPlayer = currentRoom.seats.find(s => s !== null);
        if (nextPlayer) {
          currentRoom.hostId = nextPlayer.id;
          console.log(`[Worker] Host transferred to ${nextPlayer.id} (seat ${nextPlayer.seatIndex})`);
        } else {
          currentRoom.hostId = null;
        }
      }

      // 检查房间是否全空
      const remainingPlayers = currentRoom.seats.filter(s => s !== null);
      if (remainingPlayers.length === 0) {
        // 延迟 30 秒销毁房间，允许短时间内误刷新重连
        setTimeout(() => {
          const fresh = rooms.get(roomId);
          if (fresh && fresh.seats.every(s => s === null)) {
            rooms.delete(roomId);
            console.log(`[Worker] Room ${roomId} cleaned up (all players left)`);
          }
        }, 30000);
      } else {
        // 通知房间内其他存活玩家
        broadcastToRoom(currentRoom, {
          type: 'PLAYER_LEFT',
          seatIndex: mySeatIndex,
          newHostId: currentRoom.hostId,
          roomData: serializeRoom(currentRoom)
        });
      }
    }
  };

  serverWs.addEventListener('close', handleDisconnect);
  serverWs.addEventListener('error', handleDisconnect);
}

/**
 * Cloudflare Worker 主出口 (Fetch Handler)
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // 2. 健康检查与状态展示
    if (url.pathname === '/' || url.pathname === '/health') {
      let totalPlayers = 0;
      rooms.forEach(r => {
        totalPlayers += r.seats.filter(s => s !== null).length;
      });

      return new Response(JSON.stringify({
        status: 'online',
        service: 'Party Games UNO Multiplayer Hub (Cloudflare Worker)',
        activeRooms: rooms.size,
        totalConnectedPlayers: totalPlayers,
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. 房间信息查询 API: /api/room?id=123456
    if (url.pathname === '/api/room') {
      const roomId = url.searchParams.get('id');
      const room = rooms.get(roomId);
      if (!room) {
        return new Response(JSON.stringify({ exists: false }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      return new Response(JSON.stringify({
        exists: true,
        roomId: room.id,
        playerCount: room.seats.filter(s => s !== null).length,
        gameStarted: room.gameStarted
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 4. WebSocket 握手校验与升级
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket connection. Connect via wss://', { status: 426 });
    }

    // 提取房间及玩家参数
    const roomId = url.searchParams.get('room') || '100001';
    const playerName = url.searchParams.get('name') || '玩家';
    const clientId = url.searchParams.get('clientId') || ('client_' + Math.random().toString(36).substring(2, 10));
    const isCreate = url.searchParams.get('create') === '1' || url.searchParams.get('create') === 'true';

    // 实例化 WebSocketPair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 激活服务端 WebSocket
    server.accept();

    // 挂载房间会话
    handleSession(server, { roomId, playerName, clientId, isCreate });

    // 返回 101 Switching Protocols 建立连接
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
};
