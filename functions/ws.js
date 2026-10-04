/**
 * ============================================================================
 * 🌈 彩虹乌诺牌 · Cloudflare Pages 原生全自动云函数 (Pages Function /ws)
 * ============================================================================
 * 
 * 本文件由 Cloudflare Pages 在 GitHub Push 时自动编译与部署！
 * 无需手动在 Cloudflare Dashboard 创建任何独立 Worker，
 * 直接与前端同域名同源提供 WebSocket 实时对战能力：
 * 访问地址：wss://<你的-pages-域名>.pages.dev/ws
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
        console.error(`[Pages Function] Send failed to seat ${slot.seatIndex}:`, err);
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
    console.log(`[Pages Function] Client ${clientId} reconnected to room ${roomId} seat ${mySeatIndex}`);
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
    console.log(`[Pages Function] Client ${clientId} joined room ${roomId} at seat ${mySeatIndex} (host: ${currentRoom.hostId === clientId})`);
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
          broadcastToRoom(currentRoom, {
            type: 'GAME_ACTION',
            seatIndex: mySeatIndex,
            action: data.action,
            payload: data.payload,
            syncId: data.syncId || Date.now()
          }, serverWs); // excludeWs: 乐观渲染
          break;

        // 房主全量状态快照同步
        case 'HOST_STATE_SYNC':
          if (currentRoom.hostId === clientId) {
            broadcastToRoom(currentRoom, {
              type: 'HOST_STATE_SYNC',
              snapshot: data.snapshot
            }, serverWs);
          }
          break;

        // 聊天互动与表情
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
          console.warn(`[Pages Function] Unhandled message type: ${data.type}`);
          break;
      }
    } catch (err) {
      console.error('[Pages Function] Error processing message:', err);
    }
  });

  // 5. 监听断开连接事件
  const handleDisconnect = () => {
    console.log(`[Pages Function] Seat ${mySeatIndex} disconnected from room ${roomId}`);
    if (currentRoom && currentRoom.seats[mySeatIndex]) {
      currentRoom.seats[mySeatIndex] = null;

      // 房主转移给下一个在座玩家
      if (currentRoom.hostId === clientId) {
        const nextPlayer = currentRoom.seats.find(s => s !== null);
        if (nextPlayer) {
          currentRoom.hostId = nextPlayer.id;
          console.log(`[Pages Function] Host transferred to ${nextPlayer.id} (seat ${nextPlayer.seatIndex})`);
        } else {
          currentRoom.hostId = null;
        }
      }

      // 检查房间是否全空
      const remainingPlayers = currentRoom.seats.filter(s => s !== null);
      if (remainingPlayers.length === 0) {
        setTimeout(() => {
          const fresh = rooms.get(roomId);
          if (fresh && fresh.seats.every(s => s === null)) {
            rooms.delete(roomId);
            console.log(`[Pages Function] Room ${roomId} cleaned up (all players left)`);
          }
        }, 30000);
      } else {
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
 * Cloudflare Pages Function onRequest 主路由处理函数
 * 响应路径：/ws
 */
export async function onRequest(context) {
  const { request } = context;
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

  // 2. 健康检查与状态展示 (GET /ws 非 WebSocket 访问)
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    let totalPlayers = 0;
    rooms.forEach(r => {
      totalPlayers += r.seats.filter(s => s !== null).length;
    });

    return new Response(JSON.stringify({
      status: 'online',
      service: 'Party Games UNO Multiplayer (Cloudflare Pages Function)',
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

  // 3. WebSocket 握手升级
  const roomId = url.searchParams.get('room') || '100001';
  const playerName = url.searchParams.get('name') || '玩家';
  const clientId = url.searchParams.get('clientId') || ('client_' + Math.random().toString(36).substring(2, 10));
  const isCreate = url.searchParams.get('create') === '1' || url.searchParams.get('create') === 'true';

  // 实例化 WebSocketPair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  // 挂载房间会话
  handleSession(server, { roomId, playerName, clientId, isCreate });

  // 返回 101 状态码完成协议切换
  return new Response(null, {
    status: 101,
    webSocket: client
  });
}
