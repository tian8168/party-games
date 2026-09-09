// ==========================================================================
// 💜 3D 立体四子棋 (3D Connect Four) · 独立 3D 游戏引擎
// ==========================================================================

window.GAME_KEY = 'GRAVITY3D4';
window.GAME_RULES = {
  'GRAVITY3D4': {"title":"💜 3D 立体四子棋 规则","body":"<p><strong>三维结构：</strong>4×4×4 三维魔方棋盘，共 16 根立柱，每柱最多 4 颗珠子（64 个空间节点）。</p><br><p><strong>胜利目标：</strong>率先连成 <b>4 颗空间直线</b> 者获胜！共有 <b>76 条</b> 可能的胜利线！</p>"}
};

const STATE = {
  currentView: 'GAME',
  currentGame: 'GRAVITY3D4',
  gameMode: 'AI',
  turn: 1,
  winner: null,
  animating: false,
  online: {
    roomId: null,
    myRole: null,
    connected: false,
    mqttClient: null,
    opponentJoined: false
  },
  gravity3d4: {
    
    board: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new Array(4).fill(0))),
    hoverRod: null,
    winningLine: null,
    lastMove: null
  
  }
};
window.STATE = STATE;

function switchGameMode(mode, doReset = true) {
  if (typeof AUDIO !== 'undefined' && AUDIO.play) AUDIO.play('click');
  STATE.gameMode = mode;
  document.getElementById('tab-online').classList.toggle('active', mode === 'ONLINE');
  document.getElementById('tab-ai').classList.toggle('active', mode === 'AI');
  document.getElementById('tab-local').classList.toggle('active', mode === 'LOCAL');
  document.getElementById('online-panel').classList.toggle('hidden', mode !== 'ONLINE');

  if (doReset) {
    resetCurrentGame();
  }
}

function checkIsMyTurn() {
  if (STATE.gameMode === 'LOCAL') return true;
  if (STATE.gameMode === 'AI') return STATE.turn === 1;
  if (STATE.gameMode === 'ONLINE') {
    if (!STATE.online.opponentJoined) return false;
    if (STATE.online.myRole === 'host' && STATE.turn === 1) return true;
    if (STATE.online.myRole === 'guest' && STATE.turn === 2) return true;
    return false;
  }
  return false;
}

function endTurn() {
  STATE.turn = STATE.turn === 1 ? 2 : 1;
  updateScoreboard();

  if (!STATE.winner && STATE.gameMode === 'AI' && STATE.turn !== 1) {
    STATE.animating = true;
    const status = document.getElementById('status-text');
    if (status) status.textContent = '🤖 黄方电脑 正在深思熟虑...';
    setTimeout(() => {
      runGravity3D4AI();
    }, 500);
  }
}

function resetCurrentGame() {
  STATE.winner = null;
  STATE.turn = 1;
  STATE.animating = false;
  STATE.gravity3d4.board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => new Array(4).fill(0)));
  STATE.gravity3d4.hoverRod = null;
  STATE.gravity3d4.winningLine = null;
  STATE.gravity3d4.lastMove = null;
  if (typeof resetSocketHighlights === 'function') resetSocketHighlights();
  if (typeof set3DHover === 'function') set3DHover(null, null);
  updateScoreboard();
  update3DScene();
}

function updateScoreboard() {
  const genericScoreboard = document.getElementById('generic-scoreboard');
  if (genericScoreboard) genericScoreboard.classList.remove('scoreboard-4p');

  const card3 = document.getElementById('card-p3');
  const card4 = document.getElementById('card-p4');
  if (card3) card3.style.display = 'none';
  if (card4) card4.style.display = 'none';

  const card1 = document.getElementById('card-p1');
  const card2 = document.getElementById('card-p2');
  if (card1) card1.classList.toggle('active', STATE.turn === 1);
  if (card2) card2.classList.toggle('active', STATE.turn === 2);

  const nameP1 = document.getElementById('name-p1');
  const nameP2 = document.getElementById('name-p2');
  if (nameP1) nameP1.textContent = '🔴 红方 (先手)';
  if (nameP2) nameP2.textContent = STATE.gameMode === 'AI' ? '🟡 黄方 (电脑)' : (STATE.gameMode === 'ONLINE' ? '🟡 黄方 (客方)' : '🟡 黄方 (后手)');

  const status = document.getElementById('status-text');
  if (status) {
    if (STATE.winner) {
      status.textContent = STATE.winner === 1 ? '🏆 🔴 红方胜利！' : '🏆 🟡 黄方胜利！';
    } else {
      if (STATE.gameMode === 'ONLINE') {
        status.textContent = !STATE.online.opponentJoined ? '⏳ 等待好友加入房间...' : (checkIsMyTurn() ? '👉 轮到你的回合！' : '⏳ 对手思考中...');
      } else if (STATE.gameMode === 'AI') {
        status.textContent = STATE.turn === 1 ? '👉 轮到你行动' : '🤖 🟡 黄方电脑思考中...';
      } else {
        status.textContent = STATE.turn === 1 ? '👉 轮到 🔴 红方行动' : '👉 轮到 🟡 黄方行动';
      }
    }
  }
}

// Online action handler
window.handleGameOnlineAction = function(msg) {
  if (msg.type === 'GRAVITY3D4_DROP') {
    const ty = get3D4LandingHeight(msg.x, msg.z);
    if (ty !== -1) execute3DDrop(msg.x, msg.z, ty, STATE.turn, false);
  }
};

// 4. 3D 立体五子棋逻辑与场景 (GRAVITY 3D)
    // ==========================================================================
    const DIRS_3D = [
      { dx: 1, dy: 0, dz: 0 }, { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: 0, dz: 1 },
      { dx: 1, dy: 1, dz: 0 }, { dx: 1, dy: -1, dz: 0 },
      { dx: 1, dy: 0, dz: 1 }, { dx: 1, dy: 0, dz: -1 },
      { dx: 0, dy: 1, dz: 1 }, { dx: 0, dy: 1, dz: -1 },
      { dx: 1, dy: 1, dz: 1 }, { dx: 1, dy: 1, dz: -1 },
      { dx: 1, dy: -1, dz: 1 }, { dx: 1, dy: -1, dz: -1 }
    ];

    function get3DLandingHeight(x, z) {
      const b = STATE.gravity3d.board;
      for (let y = 0; y < 5; y++) {
        if (b[x][y][z] === 0) return y;
      }
      return -1;
    }

    function get3D4LandingHeight(x, z) {
      const b = STATE.gravity3d4.board;
      for (let y = 0; y < 4; y++) {
        if (b[x][y][z] === 0) return y;
      }
      return -1;
    }

    function check3DWin(x, y, z, player) {
      const b = STATE.gravity3d.board;
      for (const d of DIRS_3D) {
        let line = [{ x, y, z }];
        let step = 1;
        while (true) {
          const nx = x + d.dx * step, ny = y + d.dy * step, nz = z + d.dz * step;
          if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && nz >= 0 && nz < 5 && b[nx][ny][nz] === player) {
            line.push({ x: nx, y: ny, z: nz }); step++;
          } else break;
        }
        step = 1;
        while (true) {
          const nx = x - d.dx * step, ny = y - d.dy * step, nz = z - d.dz * step;
          if (nx >= 0 && nx < 5 && ny >= 0 && ny < 5 && nz >= 0 && nz < 5 && b[nx][ny][nz] === player) {
            line.push({ x: nx, y: ny, z: nz }); step++;
          } else break;
        }
        if (line.length >= 5) return line;
      }
      return null;
    }

    function check3DWin4(x, y, z, player) {
      const b = STATE.gravity3d4.board;
      for (const d of DIRS_3D) {
        let line = [{ x, y, z }];
        let step = 1;
        while (true) {
          const nx = x + d.dx * step, ny = y + d.dy * step, nz = z + d.dz * step;
          if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4 && nz >= 0 && nz < 4 && b[nx][ny][nz] === player) {
            line.push({ x: nx, y: ny, z: nz }); step++;
          } else break;
        }
        step = 1;
        while (true) {
          const nx = x - d.dx * step, ny = y - d.dy * step, nz = z - d.dz * step;
          if (nx >= 0 && nx < 4 && ny >= 0 && ny < 4 && nz >= 0 && nz < 4 && b[nx][ny][nz] === player) {
            line.push({ x: nx, y: ny, z: nz }); step++;
          } else break;
        }
        if (line.length >= 4) return line;
      }
      return null;
    }

    function drop3DRod(x, z) {
      if (STATE.winner || STATE.animating) return;
      if (!checkIsMyTurn()) {
        if (STATE.gameMode === 'ONLINE') {
          if (!STATE.online.opponentJoined) {
            showToast('💡 当前为好友联机模式：请点击【➕ 创建新房间】并将链接发给好友，或切换为【🤖 人机对战】！', 4000);
          } else {
            showToast('⏳ 正在等待对方下子...');
          }
        } else if (STATE.gameMode === 'AI') {
          showToast('🤖 电脑 AI 正在思考，请稍候...');
        }
        return;
      }

      const is4P = STATE.currentGame === 'GRAVITY3D4';
      const maxH = is4P ? 4 : 5;
      const targetY = is4P ? get3D4LandingHeight(x, z) : get3DLandingHeight(x, z);
      if (targetY === -1) {
        showToast(`⚠️ 该立柱已穿满 ${maxH} 颗珠子，请选择其他立柱！`);
        return;
      }

      execute3DDrop(x, z, targetY, STATE.turn, true);
    }

    function execute3DDrop(x, z, targetY, player, isLocalAction = false) {
      STATE.animating = true;
      if (ghostBead) ghostBead.visible = false;
      set3DHover(null, null);

      const is4P = STATE.currentGame === 'GRAVITY3D4';
      const N = is4P ? 4 : 5;
      const curSpacing = is4P ? 2.6 : 2.4;
      const posX = (x - (N - 1) / 2) * curSpacing;
      const targetPosY = targetY * (SPHERE_RADIUS * 2.1) + SPHERE_RADIUS + 0.42;
      const posZ = (z - (N - 1) / 2) * curSpacing;

      const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: player === 1 ? 0xee2c44 : 0xf59e0b,
        roughness: 0.12,
        metalness: 0.15,
        emissive: player === 1 ? 0x3d0006 : 0x3a1e00
      });
      const dropMesh = new THREE.Mesh(sphereGeo, mat);
      dropMesh.position.set(posX, 12.6, posZ);
      dropMesh.castShadow = true;
      scene.add(dropMesh);

      let curY = 12.6;
      let vy = 0.0;
      const gravity = 0.55;
      let bounces = 0;

      function stepDrop() {
        vy += gravity;
        curY -= vy;

        if (curY <= targetPosY) {
          AUDIO.play('drop');
          curY = targetPosY;
          if (bounces < 1 && Math.abs(vy) > 0.6) {
            vy = -vy * 0.28;
            bounces++;
          } else {
            scene.remove(dropMesh);
            dropMesh.geometry.dispose();
            dropMesh.material.dispose();

            if (is4P) {
              STATE.gravity3d4.board[x][targetY][z] = player;
              STATE.gravity3d4.lastMove = { x, y: targetY, z, player };
              STATE.animating = false;

              const winLine = check3DWin4(x, targetY, z, player);
              if (winLine) {
                AUDIO.play('win');
                STATE.winner = player;
                STATE.gravity3d4.winningLine = winLine;
                const pName = player === 1 ? '🔴 红珠' : '🟡 黄珠';
                showModal('🎉 3D 空间四连绝杀！', `${pName} 在三维立体空间中连成 4 颗直线，斩获最终胜利！`);
              } else {
                let full = true;
                for (let ix = 0; ix < 4; ix++) {
                  for (let iz = 0; iz < 4; iz++) {
                    if (STATE.gravity3d4.board[ix][3][iz] === 0) { full = false; break; }
                  }
                }
                if (full) {
                  STATE.winner = 3;
                  showModal('🤝 势均力敌', '64 个空间点位已全满，双方达成平局！');
                } else {
                  endTurn();
                }
              }
            } else {
              STATE.gravity3d.board[x][targetY][z] = player;
              STATE.gravity3d.lastMove = { x, y: targetY, z, player };
              STATE.animating = false;

              const winLine = check3DWin(x, targetY, z, player);
              if (winLine) {
                AUDIO.play('win');
                STATE.winner = player;
                STATE.gravity3d.winningLine = winLine;
                const pName = player === 1 ? '🔴 红珠' : '🟡 黄珠';
                showModal('🎉 3D 空间五连绝杀！', `${pName} 在三维立体空间中连成 5 颗直线，获得最终胜利！`);
              } else {
                let full = true;
                for (let ix = 0; ix < 5; ix++) {
                  for (let iz = 0; iz < 5; iz++) {
                    if (STATE.gravity3d.board[ix][4][iz] === 0) { full = false; break; }
                  }
                }
                if (full) {
                  STATE.winner = 3;
                  showModal('🤝 势均力敌', '125 个空间点位已全满，双方达成平局！');
                } else {
                  endTurn();
                }
              }
            }

            if (isLocalAction && STATE.gameMode === 'ONLINE') {
              sendOnlineAction({ type: is4P ? 'GRAVITY3D4_DROP' : 'GRAVITY3D_DROP', x, z });
            }

            update3DScene();
            return;
          }
        }

        dropMesh.position.y = curY;
        requestAnimationFrame(stepDrop);
      }
      requestAnimationFrame(stepDrop);
    }

    function runGravity3DAI() {
      if (STATE.winner) return;
      const b = STATE.gravity3d.board;
      let bestRod = null;
      let maxScore = -Infinity;

      for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
          const y = get3DLandingHeight(x, z);
          if (y === -1) continue;

          let score = 0;
          b[x][y][z] = 2;
          if (check3DWin(x, y, z, 2)) { b[x][y][z] = 0; execute3DDrop(x, z, y, 2); return; }
          b[x][y][z] = 0;

          b[x][y][z] = 1;
          if (check3DWin(x, y, z, 1)) score += 20000;
          b[x][y][z] = 0;

          if (y < 4) {
            b[x][y + 1][z] = 1;
            if (check3DWin(x, y + 1, z, 1)) score -= 15000;
            b[x][y + 1][z] = 0;
          }

          const distFromCenter = Math.abs(x - 2) + Math.abs(z - 2) + Math.abs(y - 2);
          score += (6 - distFromCenter) * 15;

          if (score > maxScore) { maxScore = score; bestRod = { x, z, y }; }
        }
      }

      if (bestRod) execute3DDrop(bestRod.x, bestRod.z, bestRod.y, 2);
      else STATE.animating = false;
    }

    function runGravity3D4AI() {
      if (STATE.winner) return;
      const b = STATE.gravity3d4.board;
      let bestRod = null;
      let maxScore = -Infinity;

      for (let x = 0; x < 4; x++) {
        for (let z = 0; z < 4; z++) {
          const y = get3D4LandingHeight(x, z);
          if (y === -1) continue;

          let score = 0;
          b[x][y][z] = 2;
          if (check3DWin4(x, y, z, 2)) { b[x][y][z] = 0; execute3DDrop(x, z, y, 2); return; }
          b[x][y][z] = 0;

          b[x][y][z] = 1;
          if (check3DWin4(x, y, z, 1)) score += 20000;
          b[x][y][z] = 0;

          if (y < 3) {
            b[x][y + 1][z] = 1;
            if (check3DWin4(x, y + 1, z, 1)) score -= 15000;
            b[x][y + 1][z] = 0;
          }

          const distFromCenter = Math.abs(x - 1.5) + Math.abs(z - 1.5) + Math.abs(y - 1.5);
          score += (6 - distFromCenter) * 15;

          if (score > maxScore) { maxScore = score; bestRod = { x, z, y }; }
        }
      }

      if (bestRod) execute3DDrop(bestRod.x, bestRod.z, bestRod.y, 2);
      else STATE.animating = false;
    }

    // Three.js 3D 渲染器
    let scene, camera, renderer, controls;
    let rodMeshList = [];
    let socketMeshes = [];
    let sphereGroup, laserGroup, lastMoveHalo, ghostBead;
    let boardGroup = null;
    let current3DN = 5;
    let is3DInited = false;
    let raycaster = null;
    let mouse = null;
    if (typeof THREE !== 'undefined') {
      try {
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
      } catch(e) {}
    }

    const SPACING = 2.4;
    const SPHERE_RADIUS = 0.9;
    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    function init3DSceneIfNeeded() {
      if (is3DInited) return;
      is3DInited = true;

      const container = document.getElementById('board-3d-wrapper');
      const canvas3D = document.getElementById('board-3d-canvas');

      if (typeof THREE === 'undefined') return;
      if (!raycaster) raycaster = new THREE.Raycaster();
      if (!mouse) mouse = new THREE.Vector2();

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a);
      scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

      const rect = container.getBoundingClientRect();
      camera = new THREE.PerspectiveCamera(38, rect.width / rect.height, 0.1, 1000);
      camera.position.set(13.5, 12, 14.5);

      renderer = new THREE.WebGLRenderer({ canvas: canvas3D, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(rect.width, rect.height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      controls = new THREE.OrbitControls(camera, canvas3D);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 10;
      controls.maxDistance = 38;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.target.set(0, 4.0, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xfff8ee, 0.95);
      dirLight.position.set(16, 26, 16);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      scene.add(dirLight);

      const sideLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
      sideLight.position.set(-14, 18, -14);
      scene.add(sideLight);

      const bounceLight = new THREE.PointLight(0xd97706, 0.35, 25);
      bounceLight.position.set(0, 1.5, 0);
      scene.add(bounceLight);

      window.build3DBoard = function(n = 5) {
        if (!scene) return;
        if (boardGroup && current3DN === n) return;

        if (boardGroup) {
          scene.remove(boardGroup);
          boardGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
              else child.material.dispose();
            }
          });
        }

        boardGroup = new THREE.Group();
        current3DN = n;
        rodMeshList = [];
        socketMeshes = [];

        const N = n;
        const curSpacing = (N === 4) ? 2.6 : 2.4;
        const rodH = (N === 4) ? 9.6 : 11.8;
        const baseOuter = (N === 4) ? 13.6 : 15.4;
        const baseInner = (N === 4) ? 12.2 : 13.8;
        const halfN = (N - 1) / 2;

        // 实木底座
        const baseLower = new THREE.Mesh(new THREE.BoxGeometry(baseOuter, 0.8, baseOuter), new THREE.MeshStandardMaterial({ color: 0x18110b, roughness: 0.4, metalness: 0.15 }));
        baseLower.position.y = -0.4; baseLower.receiveShadow = true; boardGroup.add(baseLower);

        const baseTop = new THREE.Mesh(new THREE.BoxGeometry(baseInner, 0.4, baseInner), new THREE.MeshStandardMaterial({ color: 0x271911, roughness: 0.32, metalness: 0.12 }));
        baseTop.position.y = 0.2; baseTop.receiveShadow = true; boardGroup.add(baseTop);

        const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(baseInner + 0.1, 0.05, baseInner + 0.1), new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.2, metalness: 0.85 }));
        trimMesh.position.y = 0.41; boardGroup.add(trimMesh);

        // 网格暗金线
        const gridMat = new THREE.LineBasicMaterial({ color: 0x855b32, transparent: true, opacity: 0.6 });
        for (let i = 0; i < N; i++) {
          const offsetCoord = (i - halfN) * curSpacing;
          const ptsX = [new THREE.Vector3(-halfN * curSpacing, 0.415, offsetCoord), new THREE.Vector3(halfN * curSpacing, 0.415, offsetCoord)];
          boardGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsX), gridMat));
          const ptsZ = [new THREE.Vector3(offsetCoord, 0.415, -halfN * curSpacing), new THREE.Vector3(offsetCoord, 0.415, halfN * curSpacing)];
          boardGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsZ), gridMat));
        }

        // N*N 根立柱与碰撞盒
        const socketGeo = new THREE.TorusGeometry(0.38, 0.07, 16, 32);
        const rodGeo = new THREE.CylinderGeometry(0.16, 0.16, rodH, 24);
        const rodMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.92 });
        const capGeo = new THREE.SphereGeometry(0.24, 24, 16);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.1, metalness: 0.95 });
        const hitGeo = new THREE.CylinderGeometry(1.05, 1.05, rodH + 1.8, 12);
        const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });

        for (let x = 0; x < N; x++) {
          socketMeshes[x] = [];
          for (let z = 0; z < N; z++) {
            const posX = (x - halfN) * curSpacing;
            const posZ = (z - halfN) * curSpacing;

            const socketMesh = new THREE.Mesh(socketGeo, new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 }));
            socketMesh.rotation.x = Math.PI / 2; socketMesh.position.set(posX, 0.42, posZ);
            boardGroup.add(socketMesh); socketMeshes[x][z] = socketMesh;

            const rodMesh = new THREE.Mesh(rodGeo, rodMat);
            rodMesh.position.set(posX, 0.4 + rodH / 2, posZ); rodMesh.castShadow = true; boardGroup.add(rodMesh);

            const capMesh = new THREE.Mesh(capGeo, capMat);
            capMesh.position.set(posX, 0.4 + rodH, posZ); boardGroup.add(capMesh);

            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.set(posX, 0.4 + (rodH + 1.8) / 2, posZ); hitMesh.userData = { rodX: x, rodZ: z };
            boardGroup.add(hitMesh); rodMeshList.push(hitMesh);
          }
        }

        scene.add(boardGroup);
      };

      window.build3DBoard(STATE.currentGame === 'GRAVITY3D4' ? 4 : 5);

      sphereGroup = new THREE.Group(); scene.add(sphereGroup);
      laserGroup = new THREE.Group(); scene.add(laserGroup);

      // 预落子虚影球
      ghostBead = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32), new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45 }));
      ghostBead.visible = false; scene.add(ghostBead);

      // 能量环
      lastMoveHalo = new THREE.Mesh(new THREE.TorusGeometry(SPHERE_RADIUS * 1.25, 0.08, 16, 32), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      lastMoveHalo.rotation.x = Math.PI / 2; lastMoveHalo.visible = false; scene.add(lastMoveHalo);

      canvas3D.addEventListener('pointerdown', on3DPointerDown);
      canvas3D.addEventListener('pointermove', on3DPointerMove);
      canvas3D.addEventListener('pointerup', on3DPointerUp);
      canvas3D.addEventListener('pointerleave', () => set3DHover(null, null));

      animate3D();
    }

    function on3DPointerDown(e) {
      pointerDownTime = Date.now();
      pointerDownPos = { x: e.clientX, y: e.clientY };
    }
    function on3DPointerMove(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      update3DHover();
    }
    function on3DPointerUp(e) {
      const elapsed = Date.now() - pointerDownTime;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 10 || elapsed > 500) return;
      if (STATE.winner || STATE.animating) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(rodMeshList);
      if (intersects.length > 0) {
        drop3DRod(intersects[0].object.userData.rodX, intersects[0].object.userData.rodZ);
      }
    }

    let currentHoverRod = null;
    function update3DHover() {
      const is3D = STATE.currentGame === 'GRAVITY3D' || STATE.currentGame === 'GRAVITY3D4';
      if (!is3DInited || !camera || !is3D || STATE.currentView !== 'GAME') return;
      const canvas3D = document.getElementById('board-3d-canvas');
      if (STATE.winner || STATE.animating) {
        if (ghostBead) ghostBead.visible = false;
        resetSocketHighlights();
        if (canvas3D) canvas3D.style.cursor = 'grab';
        return;
      }

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(rodMeshList);
      if (intersects.length > 0) {
        set3DHover(intersects[0].object.userData.rodX, intersects[0].object.userData.rodZ);
        if (canvas3D) canvas3D.style.cursor = 'pointer';
      } else {
        set3DHover(null, null);
        if (canvas3D) canvas3D.style.cursor = 'grab';
      }
    }

    function set3DHover(x, z) {
      if (currentHoverRod && (currentHoverRod.x !== x || currentHoverRod.z !== z)) resetSocketHighlights();
      if (x === null || z === null) {
        currentHoverRod = null;
        if (ghostBead) ghostBead.visible = false;
        return;
      }

      currentHoverRod = { x, z };
      const is4 = STATE.currentGame === 'GRAVITY3D4';
      const N = is4 ? 4 : 5;
      const curSpacing = is4 ? 2.6 : 2.4;
      const ty = is4 ? get3D4LandingHeight(x, z) : get3DLandingHeight(x, z);

      if (ty !== -1 && ghostBead) {
        ghostBead.position.set((x - (N - 1) / 2) * curSpacing, ty * (SPHERE_RADIUS * 2.1) + SPHERE_RADIUS + 0.42, (z - (N - 1) / 2) * curSpacing);
        ghostBead.material.color.setHex(STATE.turn === 1 ? 0xff4757 : 0xfacc15);
        ghostBead.visible = true;
      } else if (ghostBead) {
        ghostBead.visible = false;
      }

      if (socketMeshes[x] && socketMeshes[x][z]) {
        socketMeshes[x][z].material.emissive.setHex(0x38bdf8);
        socketMeshes[x][z].material.emissiveIntensity = 0.6;
      }
    }

    function resetSocketHighlights() {
      for (let ix = 0; ix < (current3DN || 5); ix++) {
        for (let iz = 0; iz < (current3DN || 5); iz++) {
          if (socketMeshes[ix] && socketMeshes[ix][iz]) {
            socketMeshes[ix][iz].material.emissive.setHex(0x000000);
            socketMeshes[ix][iz].material.emissiveIntensity = 0;
          }
        }
      }
    }

    function reset3DCamera() {
      if (!controls || !camera) return;
      camera.position.set(13.5, 12, 14.5);
      controls.target.set(0, 4.0, 0);
      controls.update();
    }

    function resize3D() {
      if (!renderer || !camera) return;
      const container = document.getElementById('board-3d-wrapper');
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    }

    function update3DScene() {
      if (!sphereGroup) return;
      while (sphereGroup.children.length > 0) {
        const obj = sphereGroup.children[0];
        sphereGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
      }
      while (laserGroup.children.length > 0) {
        const obj = laserGroup.children[0];
        laserGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
      }

      const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
      const p1Mat = new THREE.MeshStandardMaterial({ color: 0xee2c44, roughness: 0.12, metalness: 0.15, emissive: 0x3d0006 });
      const p2Mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.12, metalness: 0.18, emissive: 0x3a1e00 });
      const winMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.2, emissive: 0x0284c7, emissiveIntensity: 0.8 });

      const is4 = (STATE.currentGame === 'GRAVITY3D4');
      const N = is4 ? 4 : 5;
      const curSpacing = is4 ? 2.6 : 2.4;
      const b = is4 ? STATE.gravity3d4.board : STATE.gravity3d.board;
      const winLine = is4 ? STATE.gravity3d4.winningLine : STATE.gravity3d.winningLine;
      const lm = is4 ? STATE.gravity3d4.lastMove : STATE.gravity3d.lastMove;

      const winCoordSet = new Set();
      if (winLine) {
        for (const p of winLine) winCoordSet.add(`${p.x},${p.y},${p.z}`);
      }

      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          for (let z = 0; z < N; z++) {
            const player = b[x][y][z];
            if (player !== 0) {
              const isWinBead = winCoordSet.has(`${x},${y},${z}`);
              const mesh = new THREE.Mesh(sphereGeo, isWinBead ? winMat : (player === 1 ? p1Mat : p2Mat));
              mesh.position.set((x - (N - 1) / 2) * curSpacing, y * (SPHERE_RADIUS * 2.1) + SPHERE_RADIUS + 0.42, (z - (N - 1) / 2) * curSpacing);
              mesh.castShadow = true; mesh.receiveShadow = true;
              sphereGroup.add(mesh);
            }
          }
        }
      }

      if (lm && !STATE.winner) {
        lastMoveHalo.position.set((lm.x - (N - 1) / 2) * curSpacing, lm.y * (SPHERE_RADIUS * 2.1) + SPHERE_RADIUS + 0.42, (lm.z - (N - 1) / 2) * curSpacing);
        lastMoveHalo.visible = true;
      } else {
        lastMoveHalo.visible = false;
      }

      if (winLine && winLine.length >= 2) {
        const pts = winLine.map(p => new THREE.Vector3((p.x - (N - 1) / 2) * curSpacing, p.y * (SPHERE_RADIUS * 2.1) + SPHERE_RADIUS + 0.42, (p.z - (N - 1) / 2) * curSpacing));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        laserGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 8 })));

        const startPt = pts[0], endPt = pts[pts.length - 1];
        const beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, startPt.distanceTo(endPt), 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
        beamMesh.position.copy(new THREE.Vector3().addVectors(startPt, endPt).multiplyScalar(0.5));
        beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(endPt, startPt).normalize());
        laserGroup.add(beamMesh);
      }
    }

    function animate3D() {
      requestAnimationFrame(animate3D);
      if (controls) controls.update();
      if (lastMoveHalo && lastMoveHalo.visible) lastMoveHalo.rotation.z += 0.03;
      if (ghostBead && ghostBead.visible) ghostBead.material.opacity = 0.38 + 0.12 * Math.sin(Date.now() * 0.008);
      const is3D = (STATE.currentGame === 'GRAVITY3D' || STATE.currentGame === 'GRAVITY3D4');
      if (renderer && scene && camera && is3D && STATE.currentView === 'GAME') {
        renderer.render(scene, camera);
      }
    }

    

window.addEventListener('DOMContentLoaded', () => {
  recordRecentGame('GRAVITY3D4');
  init3DSceneIfNeeded();
  window.build3DBoard(4);
  resetCurrentGame();
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && typeof joinExistingRoom === 'function') {
    switchGameMode('ONLINE', false);
    joinExistingRoom(roomParam);
  }
});
