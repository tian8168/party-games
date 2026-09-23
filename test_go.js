const fs = require('fs');
const vm = require('vm');

const mockCanvas = {
  getContext: () => ({
    setTransform: () => {},
    clearRect: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    fillText: () => {},
    setLineDash: () => {}
  }),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
  addEventListener: () => {},
  style: {}
};

const domElements = new Map();
function getOrCreateElement(id) {
  if (!domElements.has(id)) {
    domElements.set(id, {
      id,
      textContent: '',
      innerHTML: '',
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        toggle(c, force) {
          if (force !== undefined) {
            force ? this.classes.add(c) : this.classes.delete(c);
          } else {
            this.classes.has(c) ? this.classes.delete(c) : this.classes.add(c);
          }
        },
        contains(c) { return this.classes.has(c); }
      },
      style: {},
      addEventListener: () => {},
      appendChild: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 })
    });
  }
  return domElements.get(id);
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Math,
  Date,
  Set,
  Map,
  Array,
  JSON,
  window: {
    location: { href: 'http://localhost/games/go.html', search: '' },
    addEventListener: () => {},
    devicePixelRatio: 2
  },
  document: {
    getElementById: (id) => {
      if (id === 'board-canvas') return mockCanvas;
      return getOrCreateElement(id);
    },
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} }),
    body: { appendChild: () => {} }
  },
  showToast: (msg) => { console.log('  [Toast]', msg); },
  showModal: () => {},
  closeModal: () => {},
  initCommonHeader: () => {},
  ONLINE_NETWORK: {
    state: { roomId: null, myRole: 'host', connected: true, opponentJoined: false },
    sendAction: () => {},
    createRoom: () => '9999',
    copyLink: () => {},
    joinRoom: () => {},
    setRoleChangeHandler: () => {},
    setOpponentJoinedHandler: () => {},
    setMessageHandler: () => {}
  }
};

sandbox.window.ONLINE_NETWORK = sandbox.ONLINE_NETWORK;

const html = fs.readFileSync('./games/go.html', 'utf8');
let scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)[1];

scriptContent = scriptContent.replace(/const GO_STATE =/g, 'var GO_STATE = globalThis.GO_STATE =');
scriptContent = scriptContent.replace(/function checkMoveLegality/g, 'globalThis.checkMoveLegality = checkMoveLegality; function checkMoveLegality');
scriptContent = scriptContent.replace(/function calculateTerritoryScore/g, 'globalThis.calculateTerritoryScore = calculateTerritoryScore; function calculateTerritoryScore');
scriptContent = scriptContent.replace(/function executeMove/g, 'globalThis.executeMove = executeMove; function executeMove');
scriptContent = scriptContent.replace(/function passTurn/g, 'globalThis.passTurn = passTurn; function passTurn');
scriptContent = scriptContent.replace(/function scheduleAiMove/g, 'globalThis.scheduleAiMove = scheduleAiMove; function scheduleAiMove');
scriptContent = scriptContent.replace(/function resetCurrentGame/g, 'globalThis.resetCurrentGame = resetCurrentGame; function resetCurrentGame');
scriptContent = scriptContent.replace(/function resignGame/g, 'globalThis.resignGame = resignGame; function resignGame');
scriptContent = scriptContent.replace(/function evaluateGameSituation/g, 'globalThis.evaluateGameSituation = evaluateGameSituation; function evaluateGameSituation');
scriptContent = scriptContent.replace(/function jumpToStep/g, 'globalThis.jumpToStep = jumpToStep; function jumpToStep');
scriptContent = scriptContent.replace(/function stepFirstMove/g, 'globalThis.stepFirstMove = stepFirstMove; function stepFirstMove');
scriptContent = scriptContent.replace(/function stepPrevMove/g, 'globalThis.stepPrevMove = stepPrevMove; function stepPrevMove');
scriptContent = scriptContent.replace(/function stepNextMove/g, 'globalThis.stepNextMove = stepNextMove; function stepNextMove');
scriptContent = scriptContent.replace(/function stepLatestMove/g, 'globalThis.stepLatestMove = stepLatestMove; function stepLatestMove');
scriptContent = scriptContent.replace(/function getGridMetrics/g, 'globalThis.getGridMetrics = getGridMetrics; function getGridMetrics');
scriptContent = scriptContent.replace(/function undoMove/g, 'globalThis.undoMove = undoMove; function undoMove');
scriptContent = scriptContent.replace(/function playStone/g, 'globalThis.playStone = playStone; function playStone');
scriptContent = scriptContent.replace(/function finishGameByPass/g, 'globalThis.finishGameByPass = finishGameByPass; function finishGameByPass');
scriptContent = scriptContent.replace(/function evaluateSituation/g, 'globalThis.evaluateSituation = evaluateSituation; function evaluateSituation');
scriptContent = scriptContent.replace(/function updateSituationUI/g, 'globalThis.updateSituationUI = updateSituationUI; function updateSituationUI');
scriptContent = scriptContent.replace(/function initGame/g, 'globalThis.initGame = initGame; function initGame');
scriptContent = scriptContent.replace(/function toggleTerritoryView/g, 'globalThis.toggleTerritoryView = toggleTerritoryView; function toggleTerritoryView');
scriptContent = scriptContent.replace(/function renderBoard/g, 'globalThis.renderBoard = renderBoard; function renderBoard');
scriptContent = scriptContent.replace(/function clearPendingAiMove/g, 'globalThis.clearPendingAiMove = clearPendingAiMove; function clearPendingAiMove');
scriptContent = scriptContent.replace(/function initOnlineMultiplayer/g, 'globalThis.initOnlineMultiplayer = initOnlineMultiplayer; function initOnlineMultiplayer');

vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

console.log('=== RUNNING GO ENGINE RIGOROUS VERIFICATION ===\n');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// 1. Initial State
assert(sandbox.GO_STATE.boardSize === 9, 'Initial board size is 9');
assert(sandbox.GO_STATE.turn === 1, 'Initial turn is Black (1)');
assert(sandbox.GO_STATE.board.length === 9, 'Initial board has 9 rows');

// 2. Suicide Check
sandbox.GO_STATE.board = Array(9).fill(0).map(() => Array(9).fill(0));
sandbox.GO_STATE.board[0][1] = 1; // Black
sandbox.GO_STATE.board[1][0] = 1; // Black
let leg = sandbox.checkMoveLegality(0, 0, 2, sandbox.GO_STATE.board, null);
assert(leg.valid === false && leg.reason.includes('自杀'), 'Single stone corner suicide is forbidden');

sandbox.GO_STATE.board = Array(9).fill(0).map(() => Array(9).fill(0));
sandbox.GO_STATE.board[0][2] = 1;
sandbox.GO_STATE.board[1][0] = 1;
sandbox.GO_STATE.board[1][1] = 1;
sandbox.GO_STATE.board[0][0] = 2; // White stone
leg = sandbox.checkMoveLegality(0, 1, 2, sandbox.GO_STATE.board, null);
assert(leg.valid === false && leg.reason.includes('自杀'), 'Multi-stone group suicide is forbidden');

// 3. Capture Check
sandbox.GO_STATE.board = Array(9).fill(0).map(() => Array(9).fill(0));
sandbox.GO_STATE.board[0][1] = 1; // Black in atari
sandbox.GO_STATE.board[1][1] = 2; // White
sandbox.GO_STATE.board[0][2] = 2; // White
sandbox.GO_STATE.board[1][0] = 2; // White
leg = sandbox.checkMoveLegality(0, 0, 2, sandbox.GO_STATE.board, null);
assert(leg.valid === true && leg.captures.length === 1 && leg.captures[0].r === 0 && leg.captures[0].c === 1, 'Capturing stone with 0 own liberties is legal');

// 4. Ko Rule Check
sandbox.GO_STATE.board = Array(9).fill(0).map(() => Array(9).fill(0));
sandbox.GO_STATE.board[1][2] = 1; // Black
sandbox.GO_STATE.board[2][1] = 1; // Black
sandbox.GO_STATE.board[3][2] = 1; // Black
sandbox.GO_STATE.board[2][2] = 2; // White (in atari)
sandbox.GO_STATE.board[1][3] = 2; // White
sandbox.GO_STATE.board[3][3] = 2; // White
sandbox.GO_STATE.board[2][4] = 2; // White

leg = sandbox.checkMoveLegality(2, 3, 1, sandbox.GO_STATE.board, null);
assert(leg.valid === true && leg.newKo && leg.newKo.r === 2 && leg.newKo.c === 2, 'Ko situation detected and Ko point set to (2,2)');

sandbox.executeMove(2, 3, leg.captures, leg.newKo, false);
assert(sandbox.GO_STATE.board[2][2] === 0, 'White at (2,2) was captured');
assert(sandbox.GO_STATE.koPoint && sandbox.GO_STATE.koPoint.r === 2 && sandbox.GO_STATE.koPoint.c === 2, 'koPoint stored in state');

// White tries immediate recapture
const koLeg = sandbox.checkMoveLegality(2, 2, 2, sandbox.GO_STATE.board, sandbox.GO_STATE.koPoint);
assert(koLeg.valid === false && koLeg.reason.includes('打劫'), 'Immediate recapture of Ko is forbidden');

// White plays elsewhere
sandbox.executeMove(0, 0, [], null, false);
assert(sandbox.GO_STATE.koPoint === null, 'koPoint cleared after move elsewhere');

// Black plays elsewhere
sandbox.executeMove(0, 1, [], null, false);

// White can recapture now
const recaptureLeg = sandbox.checkMoveLegality(2, 2, 2, sandbox.GO_STATE.board, sandbox.GO_STATE.koPoint);
assert(recaptureLeg.valid === true && recaptureLeg.captures.length === 1, 'Recapture allowed after tenuki (playing elsewhere)');

// 5. Territory Scoring
sandbox.GO_STATE.board = Array(9).fill(0).map(() => Array(9).fill(0));
// Black encloses (0,0)
sandbox.GO_STATE.board[0][1] = 1;
sandbox.GO_STATE.board[1][0] = 1;
sandbox.GO_STATE.board[1][1] = 1;
// White encloses (8,8)
sandbox.GO_STATE.board[8][7] = 2;
sandbox.GO_STATE.board[7][8] = 2;
sandbox.GO_STATE.board[7][7] = 2;
const score = sandbox.calculateTerritoryScore(sandbox.GO_STATE.board, false);
assert(score.black === 1, 'Black encloses exactly 1 territory point at (0,0)');
assert(score.white === 1, 'White encloses exactly 1 territory point at (8,8)');

// 6. Territory Purity (no global state corruption during MCTS)
sandbox.GO_STATE.territoryMap = null;
sandbox.calculateTerritoryScore(sandbox.GO_STATE.board, false);
assert(sandbox.GO_STATE.territoryMap === null, 'calculateTerritoryScore with saveToGlobal=false does not mutate global state');

// 7. AI Passing Handover Check
sandbox.GO_STATE.gameMode = 'AI';
sandbox.GO_STATE.userColor = 1;
sandbox.GO_STATE.turn = 2; // AI's turn
sandbox.GO_STATE.isAiComputing = false;
sandbox.GO_STATE.gameOver = false;
sandbox.GO_STATE.passCount = 0;

const originalScheduleAiMove = sandbox.scheduleAiMove;
let aiScheduled = false;
sandbox.scheduleAiMove = () => { aiScheduled = true; };
// AI passes: isUser = false
sandbox.passTurn(false, false);
assert(sandbox.GO_STATE.turn === 1, 'After AI passes, turn correctly switches to Human (1)');
assert(!aiScheduled, 'When AI passes, scheduleAiMove is NOT called (human turn is not stolen)');

// 8. Human Passing Handover Check
aiScheduled = false;
sandbox.passTurn(false, true); // Human passes: isUser = true
assert(sandbox.GO_STATE.passCount === 2, 'Consecutive passes count reaches 2');
assert(sandbox.GO_STATE.gameOver === true, 'Consecutive passes triggers gameOver');
sandbox.scheduleAiMove = originalScheduleAiMove;

// 9. AI Resign Bug Check
sandbox.GO_STATE.gameOver = false;
sandbox.GO_STATE.gameMode = 'AI';
sandbox.GO_STATE.userColor = 1; // Human is Black
sandbox.GO_STATE.turn = 2; // AI's turn
sandbox.resignGame(false);
assert(sandbox.GO_STATE.winner === '白棋', 'In AI mode, resigning causes the human to lose and AI to win (White wins)');

// 10. Territory Button Sync on Move
const terrBtn = getOrCreateElement('btn-territory');
sandbox.GO_STATE.showTerritory = true;
terrBtn.classList.add('active-toggle');
sandbox.executeMove(4, 4, [], null, false);
assert(!terrBtn.classList.contains('active-toggle'), 'executeMove removes active-toggle class from btn-territory');

// 11. HoverPoint Clear on Move
assert(sandbox.GO_STATE.hoverPoint === null, 'executeMove clears hoverPoint to prevent red circle artifact');

// 12. AI Move Generation (EASY)
sandbox.resetCurrentGame(false);
const moveEasy = sandbox.computeBestAiMove(sandbox.GO_STATE.board, 2, 'EASY', null);
assert(moveEasy && moveEasy.r >= 0 && moveEasy.c >= 0, 'EASY AI computes a valid move');

// 13. AI Move Generation (TACTICAL)
const moveTactical = sandbox.computeBestAiMove(sandbox.GO_STATE.board, 2, 'TACTICAL', null);
assert(moveTactical && moveTactical.r >= 0 && moveTactical.c >= 0, 'TACTICAL AI computes a valid move');

// 14. AI Move Generation (MASTER MCTS)
sandbox.GO_STATE.territoryMap = null;
const moveMaster = sandbox.computeBestAiMove(sandbox.GO_STATE.board, 2, 'MASTER', null);
assert(moveMaster && moveMaster.r >= 0 && moveMaster.c >= 0, 'MASTER MCTS AI computes a valid move');
assert(sandbox.GO_STATE.territoryMap === null, 'MCTS search did not pollute global territoryMap');

// 15. Board sizes (13x13 and 19x19)
sandbox.GO_STATE.boardSize = 13;
sandbox.resetCurrentGame(false);
assert(sandbox.GO_STATE.board.length === 13, '13x13 board successfully initialized with 13 rows');
sandbox.GO_STATE.boardSize = 19;
sandbox.resetCurrentGame(false);
assert(sandbox.GO_STATE.board.length === 19, '19x19 board successfully initialized with 19 rows');

// 16. Grid Metrics & 1:1 Aspect Ratio Verification
sandbox.GO_STATE.boardSize = 19;
let metrics = sandbox.getGridMetrics();
assert(metrics.side === 600, 'Metrics side matches canvas dimension');
assert(metrics.padding === 25, '19x19 padding is correctly calculated (~0.042 * 600 = 25)');
const spanRatio19 = (metrics.side - metrics.padding * 2) / metrics.side;
assert(spanRatio19 >= 0.90 && spanRatio19 <= 0.94, `19x19 grid span ratio ${(spanRatio19 * 100).toFixed(1)}% is within 90%~94% area coverage`);
assert(Math.abs(metrics.cellSize * 18 - (metrics.side - metrics.padding * 2)) < 0.001, '19x19 cells partition grid span evenly');

sandbox.GO_STATE.boardSize = 13;
metrics = sandbox.getGridMetrics();
assert(metrics.padding === 29, '13x13 padding is correctly calculated (~0.048 * 600 = 29)');
const spanRatio13 = (metrics.side - metrics.padding * 2) / metrics.side;
assert(spanRatio13 >= 0.90 && spanRatio13 <= 0.94, `13x13 grid span ratio ${(spanRatio13 * 100).toFixed(1)}% is within 90%~94% area coverage`);

sandbox.GO_STATE.boardSize = 9;
metrics = sandbox.getGridMetrics();
assert(metrics.padding === 31, '9x9 padding is correctly calculated (~0.052 * 600 = 31)');
assert(metrics.offsetX === 0 && metrics.offsetY === 0, 'Grid is centered on square canvas without offset skew');

// 17. Global Situation Judgment (evaluateGameSituation) with 7.5 Komi
sandbox.resetCurrentGame(false);
let situation = sandbox.evaluateGameSituation(sandbox.GO_STATE.board, sandbox.GO_STATE.captures, false);
assert(situation.komi === 7.5, 'White komi is set to standard 7.5目');
assert(situation.blackTotal === 0, 'Initial black total is 0');
assert(situation.whiteTotal === 7.5, 'Initial white total includes 7.5 komi');
assert(situation.diff === -7.5, 'Initial score diff is -7.5 (White leads by 7.5 komi)');
assert(situation.leaderText.includes('白方领先 7.5 目'), 'Initial leader text announces White leading by 7.5目');
assert(situation.blackPercent + situation.whitePercent === 100, 'Situation balance percentages sum to exactly 100%');

// Situation evaluation with stones & captures
sandbox.GO_STATE.board[0][1] = 1;
sandbox.GO_STATE.board[1][0] = 1;
sandbox.GO_STATE.board[1][1] = 1; // Black territory at (0,0)
sandbox.GO_STATE.board[8][7] = 2;
sandbox.GO_STATE.board[7][8] = 2;
sandbox.GO_STATE.board[7][7] = 2; // White territory at (8,8)
sandbox.GO_STATE.captures = { 1: 3, 2: 0 }; // Black captured 3 stones
situation = sandbox.evaluateGameSituation(sandbox.GO_STATE.board, sandbox.GO_STATE.captures, false);
// Black: 1 terr + 3 caps = 4
// White: 1 terr + 0 caps + 7.5 komi = 8.5
// diff = 4 - 8.5 = -4.5 (White leads by 4.5)
assert(situation.blackTotal === 4, 'Black total is 4 (1 territory + 3 captures)');
assert(situation.whiteTotal === 8.5, 'White total is 8.5 (1 territory + 7.5 komi)');
assert(situation.diff === -4.5, 'Score diff is -4.5');
assert(situation.leaderText.includes('白方领先 4.5 目'), 'Leader text states White leading by 4.5目');

// Test Black leading situation
sandbox.GO_STATE.captures = { 1: 10, 2: 0 }; // Black has 10 captures -> Black total = 11, White = 8.5 -> Black +2.5
situation = sandbox.evaluateGameSituation(sandbox.GO_STATE.board, sandbox.GO_STATE.captures, false);
assert(situation.diff === 2.5, 'Score diff is +2.5 when Black leads');
assert(situation.leaderText.includes('黑方领先 2.5 目'), 'Leader text states Black leading by 2.5目');

// 18. Move Timeline History & Navigation (jumpToStep, stepFirstMove, stepPrevMove, etc.)
sandbox.resetCurrentGame(false);
assert(sandbox.GO_STATE.moveHistory.length === 1, 'Initial moveHistory has 1 record (opening step 0)');
assert(sandbox.GO_STATE.currentStep === 0, 'Initial currentStep is 0');

// Execute 3 sequential moves in LOCAL mode
sandbox.GO_STATE.gameMode = 'LOCAL';
sandbox.executeMove(2, 2, [], null, false); // Step 1: Black plays (2,2)
assert(sandbox.GO_STATE.moveHistory.length === 2, 'moveHistory has 2 entries after 1st move');
assert(sandbox.GO_STATE.currentStep === 1, 'currentStep advances to 1');

sandbox.executeMove(6, 6, [], null, false); // Step 2: White plays (6,6)
assert(sandbox.GO_STATE.moveHistory.length === 3, 'moveHistory has 3 entries after 2nd move');
assert(sandbox.GO_STATE.currentStep === 2, 'currentStep advances to 2');

sandbox.executeMove(4, 4, [], null, false); // Step 3: Black plays (4,4)
assert(sandbox.GO_STATE.moveHistory.length === 4, 'moveHistory has 4 entries after 3rd move');
assert(sandbox.GO_STATE.currentStep === 3, 'currentStep advances to 3');
assert(sandbox.GO_STATE.board[4][4] === 1, 'Board reflects step 3 state at (4,4)');

// Jump to step 1
sandbox.jumpToStep(1);
assert(sandbox.GO_STATE.currentStep === 1, 'jumpToStep(1) successfully sets currentStep to 1');
assert(sandbox.GO_STATE.board[2][2] === 1, 'Board at step 1 has Black at (2,2)');
assert(sandbox.GO_STATE.board[6][6] === 0, 'Board at step 1 does not have stone at (6,6)');
assert(sandbox.GO_STATE.board[4][4] === 0, 'Board at step 1 does not have stone at (4,4)');

// Navigation button functions
sandbox.stepFirstMove();
assert(sandbox.GO_STATE.currentStep === 0, 'stepFirstMove() jumps back to opening (step 0)');
assert(sandbox.GO_STATE.board[2][2] === 0, 'Board at step 0 is empty at (2,2)');

sandbox.stepNextMove();
assert(sandbox.GO_STATE.currentStep === 1, 'stepNextMove() advances from 0 to 1');
assert(sandbox.GO_STATE.board[2][2] === 1, 'Board restored to step 1');

sandbox.stepNextMove();
assert(sandbox.GO_STATE.currentStep === 2, 'stepNextMove() advances from 1 to 2');
assert(sandbox.GO_STATE.board[6][6] === 2, 'Board restored to step 2');

sandbox.stepPrevMove();
assert(sandbox.GO_STATE.currentStep === 1, 'stepPrevMove() steps back from 2 to 1');
assert(sandbox.GO_STATE.board[6][6] === 0, 'Board restored to step 1 after prevMove');

sandbox.stepLatestMove();
assert(sandbox.GO_STATE.currentStep === 3, 'stepLatestMove() jumps directly to latest move (step 3)');
assert(sandbox.GO_STATE.board[4][4] === 1, 'Board restored to step 3 after stepLatestMove');

// 19. History Branching (Playing from historical step truncates subsequent moves)
sandbox.jumpToStep(1); // Reviewing at step 1 (where Black played (2,2), now White's turn)
assert(sandbox.GO_STATE.currentStep === 1, 'Positioned at step 1');
// White plays (3,3) instead of old (6,6)
sandbox.playStone(3, 3);
assert(sandbox.GO_STATE.currentStep === 2, 'After branching move, currentStep is 2');
assert(sandbox.GO_STATE.moveHistory.length === 3, 'moveHistory truncated to 3 entries (0, 1, new 2)');
assert(sandbox.GO_STATE.board[3][3] === 2, 'New branch has White stone at (3,3)');
assert(sandbox.GO_STATE.board[6][6] === 0, 'Old branch move (6,6) was pruned');
assert(sandbox.GO_STATE.board[4][4] === 0, 'Old branch move (4,4) was pruned');

// 20. UndoMove Integration with Timeline
// In LOCAL mode, undoMove steps back 1 move and truncates history
sandbox.undoMove();
assert(sandbox.GO_STATE.currentStep === 1, 'undoMove in LOCAL mode steps back to step 1');
assert(sandbox.GO_STATE.moveHistory.length === 2, 'moveHistory truncated to 2 entries after undo');
assert(sandbox.GO_STATE.board[3][3] === 0, 'Stone at (3,3) was removed by undo');

// In AI mode, undoMove steps back 2 moves (both AI and human move)
sandbox.GO_STATE.gameMode = 'AI';
sandbox.GO_STATE.userColor = 1;
sandbox.resetCurrentGame(false);
sandbox.executeMove(2, 2, [], null, false); // Step 1: Human
sandbox.executeMove(6, 6, [], null, false); // Step 2: AI
assert(sandbox.GO_STATE.currentStep === 2, 'Two moves played in AI mode');
assert(sandbox.GO_STATE.moveHistory.length === 3, 'moveHistory has 3 entries in AI mode');
sandbox.undoMove();
assert(sandbox.GO_STATE.currentStep === 0, 'undoMove in AI mode steps back 2 moves to step 0');
assert(sandbox.GO_STATE.moveHistory.length === 1, 'moveHistory truncated to 1 entry after AI undo');
assert(sandbox.GO_STATE.board[2][2] === 0 && sandbox.GO_STATE.board[6][6] === 0, 'Both moves undone');

// 21. Illegal move during historical review does NOT truncate subsequent moves
sandbox.resetCurrentGame(false);
sandbox.GO_STATE.gameMode = 'LOCAL';
sandbox.executeMove(2, 2, [], null, false); // Step 1: Black
sandbox.executeMove(3, 3, [], null, false); // Step 2: White
sandbox.executeMove(4, 4, [], null, false); // Step 3: Black
sandbox.executeMove(5, 5, [], null, false); // Step 4: White
assert(sandbox.GO_STATE.moveHistory.length === 5, 'History has 5 snapshots (0..4)');
sandbox.jumpToStep(1); // Reviewing step 1
assert(sandbox.GO_STATE.currentStep === 1, 'Reviewing step 1');
// Attempt illegal move on occupied position (2,2)
sandbox.playStone(2, 2);
assert(sandbox.GO_STATE.moveHistory.length === 5, 'Illegal move did NOT destroy subsequent history steps (still 5)');
assert(sandbox.GO_STATE.currentStep === 1, 'Still at step 1 after illegal move attempt');
sandbox.jumpToStep(4);
assert(sandbox.GO_STATE.board[5][5] === 2, 'Subsequent move at (5,5) still intact');

// 22. AI computation cancellation on reset and game switch
sandbox.resetCurrentGame(false);
sandbox.GO_STATE.gameMode = 'AI';
sandbox.GO_STATE.isAiComputing = true;
assert(sandbox.GO_STATE.isAiComputing === true, 'isAiComputing is active');
sandbox.clearPendingAiMove();
assert(sandbox.GO_STATE.isAiComputing === false, 'clearPendingAiMove cancels isAiComputing');
sandbox.scheduleAiMove();
assert(sandbox.GO_STATE.isAiComputing === true, 'scheduleAiMove marks AI computing');
sandbox.resetCurrentGame(false);
assert(sandbox.GO_STATE.isAiComputing === false, 'resetCurrentGame cancels in-flight AI move');

// 23. GameOver state preservation in timeline and restored state
sandbox.resetCurrentGame(false);
sandbox.executeMove(0, 0, [], null, false); // Step 1
sandbox.executeMove(1, 1, [], null, false); // Step 2
sandbox.resignGame(false); // Resign at Step 2
assert(sandbox.GO_STATE.gameOver === true, 'Game is over after resign');
const finalWinner = sandbox.GO_STATE.winner;
sandbox.jumpToStep(1);
assert(sandbox.GO_STATE.gameOver === false, 'Step 1 snapshot was not gameOver');
sandbox.jumpToStep(2);
assert(sandbox.GO_STATE.gameOver === true, 'Returning to final step restores gameOver === true');
assert(sandbox.GO_STATE.winner === finalWinner, 'Returning to final step restores winner');

// 24. Online multiplayer: receiving move while reviewing history jumps to latest move first
sandbox.resetCurrentGame(false);
sandbox.GO_STATE.gameMode = 'ONLINE';
sandbox.GO_STATE.online.connected = true;
sandbox.GO_STATE.online.opponentJoined = true;
sandbox.GO_STATE.online.myRole = 'host';
sandbox.GO_STATE.online.myColor = 1; // Black
// Host plays step 1
sandbox.executeMove(2, 2, [], null, false);
// Host reviews step 0 (opening)
sandbox.jumpToStep(0);
assert(sandbox.GO_STATE.currentStep === 0, 'Host is reviewing step 0');
// Opponent (White, 2) plays step 2 at (3,3)
let onlineMsgHandler;
sandbox.ONLINE_NETWORK.setMessageHandler = (fn) => { onlineMsgHandler = fn; };
sandbox.initOnlineMultiplayer();
onlineMsgHandler({
  type: 'GO_MOVE',
  r: 3,
  c: 3,
  player: 2,
  boardSize: 9
});
assert(sandbox.GO_STATE.currentStep === 2, 'Receiving opponent move restored viewport to latest move (step 2)');
assert(sandbox.GO_STATE.moveHistory.length === 3, 'moveHistory preserved step 1 and added step 2 (length 3)');
assert(sandbox.GO_STATE.board[2][2] === 1, 'Step 1 black stone at (2,2) was NOT wiped');
assert(sandbox.GO_STATE.board[3][3] === 2, 'Step 2 white stone at (3,3) was placed');

// 25. Consistent 7.5 Komi across all game sizes in finishGameByPass
sandbox.resetCurrentGame(false);
sandbox.GO_STATE.boardSize = 9;
sandbox.finishGameByPass();
let modalContent = '';
sandbox.showModal = (title, content) => { modalContent = content; };
sandbox.finishGameByPass();
assert(modalContent.includes('7.5'), 'finishGameByPass uses 7.5 komi on 9x9 board');
sandbox.GO_STATE.boardSize = 19;
sandbox.resetCurrentGame(false);
sandbox.finishGameByPass();
assert(modalContent.includes('7.5'), 'finishGameByPass uses 7.5 komi on 19x19 board');

// Reset to 9x9 for clean state
sandbox.GO_STATE.boardSize = 9;
sandbox.resetCurrentGame(false);

// 23. Situation Judgment System Rigorous Verification
assert(typeof sandbox.evaluateSituation === 'function', 'evaluateSituation function exists');
assert(typeof sandbox.updateSituationUI === 'function', 'updateSituationUI function exists');
assert(typeof sandbox.initGame === 'function', 'initGame function exists');
assert(typeof sandbox.toggleTerritoryView === 'function', 'toggleTerritoryView function exists');

// Verify evaluateSituation returns identical result to evaluateGameSituation
sandbox.GO_STATE.board[0][1] = 1;
sandbox.GO_STATE.board[1][0] = 1;
sandbox.GO_STATE.board[1][1] = 1;
sandbox.GO_STATE.board[8][7] = 2;
sandbox.GO_STATE.board[7][8] = 2;
sandbox.GO_STATE.board[7][7] = 2;
const evalSit = sandbox.evaluateSituation(sandbox.GO_STATE.board, sandbox.GO_STATE.captures, false);
const evalGameSit = sandbox.evaluateGameSituation(sandbox.GO_STATE.board, sandbox.GO_STATE.captures, false);
assert(evalSit.diff === evalGameSit.diff, 'evaluateSituation diff matches evaluateGameSituation');
assert(evalSit.blackTerritory === 1, 'evaluateSituation correctly identifies Black territory');
assert(evalSit.whiteTerritory === 1, 'evaluateSituation correctly identifies White territory');
assert(evalSit.leaderText === evalGameSit.leaderText, 'evaluateSituation leaderText matches');

// Test updateSituationUI updates all target DOM nodes
const cardEl = getOrCreateElement('judgment-card');
const leadEl = getOrCreateElement('judgment-lead-text');
const tagEl = getOrCreateElement('judgment-status-tag');
const barB = getOrCreateElement('bar-black');
const barW = getOrCreateElement('bar-white');
const btnSit = getOrCreateElement('btn-situation');
const btnTerrLegacy = getOrCreateElement('btn-territory');
const toggleTerrCheck = getOrCreateElement('toggle-territory-check');

sandbox.GO_STATE.showTerritory = true;
sandbox.updateSituationUI(evalSit);
assert(cardEl.classList.contains('active-mode'), 'updateSituationUI sets active-mode on judgment-card when showTerritory is true');
assert(leadEl.textContent.includes('目'), 'judgment-lead-text content updated with points lead');
assert(tagEl.textContent.length > 0, 'judgment-status-tag text updated');
assert(barB.style.width === evalSit.blackPercent + '%', 'bar-black width updated to percentage');
assert(barW.style.width === evalSit.whitePercent + '%', 'bar-white width updated to percentage');
assert(btnSit.classList.contains('active-toggle'), 'btn-situation receives active-toggle class');
assert(btnTerrLegacy.classList.contains('active-toggle'), 'legacy btn-territory receives active-toggle class');
assert(toggleTerrCheck.checked === true, 'toggle-territory-check set to true');

// Test toggleTerritoryView()
sandbox.GO_STATE.showTerritory = false;
sandbox.toggleTerritoryView();
assert(sandbox.GO_STATE.showTerritory === true, 'toggleTerritoryView toggles showTerritory to true');
assert(btnSit.classList.contains('active-toggle'), 'toggleTerritoryView activates btn-situation');
assert(btnTerrLegacy.classList.contains('active-toggle'), 'toggleTerritoryView activates legacy btn-territory');

sandbox.toggleTerritoryView();
assert(sandbox.GO_STATE.showTerritory === false, 'toggleTerritoryView toggles showTerritory back to false');
assert(!btnSit.classList.contains('active-toggle'), 'toggleTerritoryView removes active-toggle from btn-situation');
assert(!btnTerrLegacy.classList.contains('active-toggle'), 'toggleTerritoryView removes active-toggle from legacy btn-territory');

// Test initGame()
sandbox.GO_STATE.turn = 2;
sandbox.initGame(false);
assert(sandbox.GO_STATE.turn === 1, 'initGame resets turn to Black (1)');
assert(sandbox.GO_STATE.board[0][1] === 0, 'initGame resets board');
assert(sandbox.GO_STATE.showTerritory === false, 'initGame resets showTerritory to false');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);


