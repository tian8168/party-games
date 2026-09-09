# 🎮 游戏平台与 15 款独立游戏代码重合与映射分析报告

本文档详细梳理了单文件主大厅 `index.html` 中与 `games/` 目录下 15 款独立 HTML 游戏完全重合的代码片段位置。

---

## 📊 重合代码分布概览

在原始的 `index.html` (约 12,256 行) 中，代码结构分为三大部分：
1. **公共基础设施**（大厅 UI 样式、通用 CSS 变量、Web Audio 纯音效引擎、MQTT 联机中枢、顶部导航栏）
2. **专属 HTML 舞台 DOM 容器**（每个游戏独立的 Viewport / Canvas / Controls）
3. **专属 JS 游戏引擎逻辑**（各游戏的物理引擎、判胜算法、AI 决策树、渲染循环）

由于之前进行了解耦拆分，`games/*.html` 中包含的正是下面所列出的各个游戏的专属 CSS、DOM 与 JS 核心逻辑。

---

## 🔍 15 款游戏重合代码详细映射表

### 1. 🧱 步步为营 (Quoridor)
- **对应独立文件**: [`games/quoridor.html`](file:///games/quoridor.html)
- **样式 CSS 重合位置**: `第 708 - 720 行 (`.quoridor-mode-bar`, `.toolbar-quoridor`, `.tool-btn`)`
- **DOM 舞台容器重合位置**: `第 3140 - 3175 行 (`#board-canvas`, `#toolbar-quoridor`, `#quoridor-player-toggle`)`
- **JS 核心逻辑重合位置**: `第 5279 - 5517 行` (约 `5517` 行)
- **重合的核心 JS 函数列表**:
  - `isBlockedByWall(r1, c1, r2, c2)` - 计算相邻格子是否有挡板阻挡
  - `getValidPawnMoves(player)` - 计算移动与跳跃规则（正面跳跃/斜向绕行）
  - `hasPath(...)` - BFS 广度优先搜索算法，确保放置挡板后玩家依然有活路
  - `getShortestDistance(...)` - BFS 计算棋子到达终点的最短路径（供 AI 决策）
  - `canPlaceWall(type, r, c)` - 校验挡板放置合法性（是否重叠/交叉/堵死通路）
  - `executeQuoridorMove(r, c)` & `executeQuoridorWall(type, r, c)` - 移动与放墙落子执行
  - `runQuoridorAI()` - AI 攻防决策评估逻辑

---

### 2. 🔫 恶魔轮盘赌 (Devil's Roulette)
- **对应独立文件**: [`games/roulette.html`](file:///games/roulette.html)
- **样式 CSS 重合位置**: `第 882 - 1030 行 (`#roulette-stage`, `.shotgun-svg`, `.hp-hearts-box`, `.roulette-actions`)`
- **DOM 舞台容器重合位置**: `第 3260 - 3310 行 (`#roulette-stage`, `#roulette-gun`, `#roulette-my-items`)`
- **JS 核心逻辑重合位置**: `第 6826 - 7109 行` (约 `7109` 行)
- **重合的核心 JS 函数列表**:
  - `initRouletteGame()` - 初始化弹药序列（实弹/空包弹）、血量与道具库
  - `rouletteShoot(target)` - 触发射击逻辑（朝对方开枪 / 朝自己开枪）
  - `executeRouletteShot(target)` - 结算命中伤害、手铐限制、续回合逻辑
  - `useRouletteItem(itemKey)` - 道具效果结算（放大镜看弹药 / 锯子双倍伤害 / 饮料抽弹 / 烟卷恢复血量）
  - `runRouletteAI()` - 计算机智能算弹概率与道具使用策略

---

### 3. ⬇️ 重力五子棋 (Gravity Gomoku 2D)
- **对应独立文件**: [`games/gravity.html`](file:///games/gravity.html)
- **样式 CSS 重合位置**: `第 700 - 740 行 (复用 `.stage-wrapper` 与 2D Canvas 基础容器)`
- **DOM 舞台容器重合位置**: `第 3140 - 3175 行 (复用 `#board-canvas` 2D 画布)`
- **JS 核心逻辑重合位置**: `第 5518 - 5822 行` (约 `5822` 行)
- **重合的核心 JS 函数列表**:
  - `executeGravityDrop(col, row, player)` - 计算棋子在 9x9 阵列中的重力下落与落子动画
  - `checkGravityWin(board, r, c, player)` - 检查横、竖、主斜、副斜 4 个方向的 5 子连线胜负
  - `getGravityLandingRow(col)` - 获取指定列当前最下方的空位行
  - `runGravity2DAI()` - AI 局势评估算法（攻守权重计算）
  - `renderGravity2D()` - Canvas 2D 棋盘与棋子渲染引擎

---

### 4. 🟡 重力四子棋 (Connect Four)
- **对应独立文件**: [`games/gravity4.html`](file:///games/gravity4.html)
- **样式 CSS 重合位置**: `第 1051 - 1100 行 (`#toolbar-gravity4`, `.gravity-col-btn`)`
- **DOM 舞台容器重合位置**: `第 3176 - 3210 行 (`#toolbar-gravity4` 7列落子按钮栏)`
- **JS 核心逻辑重合位置**: `第 5823 - 6180 行` (约 `6180` 行)
- **重合的核心 JS 函数列表**:
  - `dropGravity4Col(col)` - 处理 7 列式经典下落落子
  - `checkGravity4Win(board)` - 6x7 盘面 4 子连线检测算法
  - `runGravity4AI()` - Minimax/启发式四子棋电脑决策
  - `renderGravity4()` - Canvas 2D 四子棋盘面渲染

---

### 5. 🧊 3D 立体五子棋 (3D Gravity Gomoku)
- **对应独立文件**: [`games/gravity3d.html`](file:///games/gravity3d.html)
- **样式 CSS 重合位置**: `第 740 - 780 行 (`#board-3d-wrapper`, `.btn-reset-cam`, `.tip-3d-overlay`)`
- **DOM 舞台容器重合位置**: `第 3211 - 3259 行 (`#board-3d-wrapper`, `#board-3d-canvas`)`
- **JS 核心逻辑重合位置**: `第 6181 - 6825 行` (约 `6825` 行)
- **重合的核心 JS 函数列表**:
  - `init3DSceneIfNeeded()` - 初始化 Three.js 渲染器、场景、灯光与 OrbitControls 轨道控制器
  - `build3DBoard(size)` - 构建 5x5x5 空间透明基座与柱子网格
  - `execute3DDrop(x, z, y, player)` - 3D 空间棋子下落与光效微粒动画
  - `check3DWin(...)` - 空间 3D 轴向（26 个空间矢量方向）连线判胜
  - `runGravity3DAI()` - 3D 空间威胁度智能评估引擎

---

### 6. 💜 3D 立体四子棋 (3D Connect Four)
- **对应独立文件**: [`games/gravity3d4.html`](file:///games/gravity3d4.html)
- **样式 CSS 重合位置**: `第 740 - 780 行 (复用 Three.js 3D 空间画布)`
- **DOM 舞台容器重合位置**: `第 3211 - 3259 行 (复用 `#board-3d-wrapper`)`
- **JS 核心逻辑重合位置**: `第 6181 - 6825 行 (与 3D 五子棋共用基底，参数设为 `size=4`, `winLen=4`)` (约 `6825 (与 3D 五子棋共用基底，参数设为 `size=4`, `winLen=4`)` 行)
- **重合的核心 JS 函数列表**:
  - 复用 3D 引擎 `build3DBoard(4)` 构建 4x4x4 空间网格
  - 复用 3D 空间射线检测（Raycaster）与鼠标拾取柱子逻辑
  - `runGravity3D4AI()` - 4x4x4 空间四子棋 AI 决策

---

### 7. 🏒 极光桌上冰球 (Air Hockey)
- **对应独立文件**: [`games/hockey.html`](file:///games/hockey.html)
- **样式 CSS 重合位置**: `第 1030 - 1051 行 (`#hockey-stage`, `#hockey-canvas`)`
- **DOM 舞台容器重合位置**: `第 3311 - 3340 行 (`#hockey-stage`, `#hockey-canvas`)`
- **JS 核心逻辑重合位置**: `第 7110 - 7369 行` (约 `7369` 行)
- **重合的核心 JS 函数列表**:
  - `initHockeyGame()` - 初始化冰球与两侧击球手物理参数
  - `updateHockeyPhysics()` - 2D 刚体碰撞、摩擦力衰减与球门进球判定
  - `renderHockey()` - 高帧率 60FPS 极光冰场光效绘制
  - `runHockeyAI()` - 电脑击球手追球与防守拦截逻辑

---

### 8. ⚡ 拔刀居合斩 (Iaido Reaction)
- **对应独立文件**: [`games/iaido.html`](file:///games/iaido.html)
- **样式 CSS 重合位置**: `第 1182 - 1324 行 (`#iaido-stage`, `.iaido-moon`, `.iaido-kanji`, `.iaido-slash-line`)`
- **DOM 舞台容器重合位置**: `第 3341 - 3390 行 (`#iaido-stage`, `#iaido-slash-overlay`)`
- **JS 核心逻辑重合位置**: `第 7747 - 7851 行` (约 `7851` 行)
- **重合的核心 JS 函数列表**:
  - `initIaidoGame()` - 初始化对决生命值与随机等待计时器（1.5s - 4.5s）
  - `triggerIaidoSignal()` - 随机时间点展示“斬”字信号并开启毫秒级计时
  - `handleIaidoTap()` - 处理玩家抢答：提前点击判定为抢跑（抢先扣血），出现信号后点击计算反应毫秒数
  - `resetIaidoMatch()` - 对决胜负结算与回合重置

---

### 9. 🎲 皇家大话骰 (Liar's Dice)
- **对应独立文件**: [`games/liarsdice.html`](file:///games/liarsdice.html)
- **样式 CSS 重合位置**: `第 1324 - 1515 行 (`#liarsdice-stage`, `.dice-tray`, `.die-face`, `.liars-controls`)`
- **DOM 舞台容器重合位置**: `第 3391 - 3450 行 (`#liarsdice-stage`, `#liars-my-tray`, `#liars-qty-val`)`
- **JS 核心逻辑重合位置**: `第 7852 - 8040 行` (约 `8040` 行)
- **重合的核心 JS 函数列表**:
  - `initLiarsDiceGame()` - 为双方玩家生成 5 颗随机骰子并摇骰
  - `submitLiarsBid()` - 叫注加码校验（喊出的数量或点数必须大于上一轮）
  - `submitLiarsChallenge()` - 开骰抓大话：结算场上指定点数（含 1 点变野点）的总数量
  - `runLiarsDiceAI()` - 概率推演与吹牛/抓大话电脑 AI

---

### 10. 🚗 物理飞车相扑 (Car Sumo)
- **对应独立文件**: [`games/sumo.html`](file:///games/sumo.html)
- **样式 CSS 重合位置**: `第 1515 - 1621 行 (`#sumo-stage`, `.sumo-hud`, `.btn-sumo-boost`, `.sumo-touch-hint`)`
- **DOM 舞台容器重合位置**: `第 3451 - 3505 行 (`#sumo-stage`, `#sumo-canvas`, `#btn-sumo-p1`, `#btn-sumo-p2`)`
- **JS 核心逻辑重合位置**: `第 8041 - 8618 行` (约 `8618` 行)
- **重合的核心 JS 函数列表**:
  - `initSumoGame()` - 初始化圆形相扑擂台与 2 辆赛车的质量、冲刺加速度向量
  - `updateSumoPhysics()` - 车体冲撞动量守恒、旋转角速度与出界掉落判定
  - `renderSumo()` - 渲染赛车轮胎痕迹、冲刺火焰与圆形擂台边缘
  - `runSumoAI()` - AI 调整车头朝向并定时发动喷射冲撞

---

### 11. 🎯 3D 坦克大战 (3D Tank War)
- **对应独立文件**: [`games/tank.html`](file:///games/tank.html)
- **样式 CSS 重合位置**: `第 1621 - 1714 行 (`#tank-stage`, `#tank-canvas`)`
- **DOM 舞台容器重合位置**: `第 3506 - 3540 行 (`#tank-stage`, `#tank-canvas`)`
- **JS 核心逻辑重合位置**: `第 8619 - 8887 行` (约 `8887` 行)
- **重合的核心 JS 函数列表**:
  - `initTankGame()` - 生成带高低落差丘陵的 3D 地形与双视角坦克
  - `fireTankBullet()` - 发射抛物线弹道炮弹
  - `updateTankPhysics()` - 重力抛物线运动、风力偏转与地形弹坑击中判定
  - `renderTank()` - 3D 线框视角与爆炸粒子效果绘制

---

### 12. 🥞 3D 堆叠大师 (3D Stack Master)
- **对应独立文件**: [`games/stack.html`](file:///games/stack.html)
- **样式 CSS 重合位置**: `第 1714 - 1777 行 (`#stack-stage`, `#stack-canvas`)`
- **DOM 舞台容器重合位置**: `第 3541 - 3570 行 (`#stack-stage`, `#stack-canvas`)`
- **JS 核心逻辑重合位置**: `第 8888 - 9139 行` (约 `9139` 行)
- **重合的核心 JS 函数列表**:
  - `initStackGame()` - 初始化基础高塔平台与滑动切割平面的初始位置
  - `placeStackBlock()` - 触发落子：精准计算前后方块重叠区域，切掉未重叠部分
  - `updateStackAnimation()` - 摄像机随高塔上升平滑移动与极光色彩渐变
  - `renderStack()` - 3D 轴侧视角方块透视渲染

---

### 13. 💥 魂斗罗双人动作 (Contra 2P Action)
- **对应独立文件**: [`games/contra.html`](file:///games/contra.html)
- **样式 CSS 重合位置**: `第 1777 - 1992 行 (`.stage-wrapper.contra-mode`, `#contra-stage`, `#contra-canvas`)`
- **DOM 舞台容器重合位置**: `第 3571 - 3610 行 (`#contra-stage`, `#contra-canvas`)`
- **JS 核心逻辑重合位置**: `第 9140 - 10039 行` (约 `10039` 行)
- **重合的核心 JS 函数列表**:
  - `initContraGame()` - 经典横版闯关环境初始化、玩家血量与多重枪械弹药库（S弹/散弹/L弹）
  - `updateContraPhysics()` - 平台重力跳跃、滚动避弹、敌人 AI 刷新与弹幕碰撞
  - `spawnContraEnemies()` - 丛林关卡炮台、飞行胶囊与异形敌人波次刷新
  - `renderContra()` - 复古 8-bit / 16-bit 像素关卡背景与角色动画

---

### 14. 🛡️ 坦克大乱斗 (Tank Trouble)
- **对应独立文件**: [`games/tanktrouble.html`](file:///games/tanktrouble.html)
- **样式 CSS 重合位置**: `第 1992 - 2172 行 (`.stage-wrapper.tanktrouble-mode`, `#tanktrouble-stage`)`
- **DOM 舞台容器重合位置**: `第 3611 - 3650 行 (`#tanktrouble-stage`, `#tanktrouble-canvas`)`
- **JS 核心逻辑重合位置**: `第 10040 - 10981 行` (约 `10981` 行)
- **重合的核心 JS 函数列表**:
  - `initTankTroubleGame()` - 随机生成 迷宫墙体与坦克诞生点
  - `updateTankTroublePhysics()` - 坦克移动、旋转、炮弹在迷宫墙壁上的**多次跳弹反弹算法**
  - `renderTankTrouble()` - 迷宫墙壁、坦克履带与跳弹轨迹绘制
  - `runTankTroubleAI()` - 迷宫寻路与反弹角度预判 AI

---

### 15. ✈️ 四人飞行棋 (Aeroplane Chess)
- **对应独立文件**: [`games/aeroplane.html`](file:///games/aeroplane.html)
- **样式 CSS 重合位置**: `第 2172 - 2470 行 (`#aeroplane-stage`, `.aero-dice-btn`, `.aero-plane-picker`)`
- **DOM 舞台容器重合位置**: `第 3651 - 3720 行 (`#aeroplane-stage`, `#aeroplane-canvas`, `#aero-plane-picker`)`
- **JS 核心逻辑重合位置**: `第 10982 - 12240 行` (约 `12240` 行)
- **重合的核心 JS 函数列表**:
  - `initAeroplaneGame()` - 初始化 4 色（红/绿/蓝/黄）棋盘 52 个环形赛道与停机坪
  - `handleAeroplaneRoll()` - 掷骰子（点数 6 可起飞或获得再掷一次奖励）
  - `executeAeroplaneMove(player, plane, roll)` - 飞行路径计算（同色飞跃、撞击敌方战机回停机坪、终点精准叠降）
  - `runAeroplaneAI()` - 4 人飞行棋电脑智能战术选择（优先起飞/撞敌/飞跃）

---

## 💡 代码架构拆分与重构建议

1. **若采用“跳转式独立模式”**：
   * `index.html` 只需要保留 **公共 CSS + 大厅 Card 瀑布流 + 大厅 JS**（仅约 1,100 行），将上述所有重合的舞台 DOM 及 JS 游戏代码从 `index.html` 中彻底移除。
   * 玩家点击卡片时，直接跳转至 `games/<game_name>.html` 独立运行。

2. **若采用“单页无缝切换 (SPA) 模式”**：
   * `index.html` 保留全部代码，而 `games/*.html` 仅作为离线单机包或独立嵌入页存在。

