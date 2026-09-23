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
scriptContent = scriptContent.replace(/function computeBestAiMove/g, 'globalThis.computeBestAiMove = computeBestAiMove; function computeBestAiMove');

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

// Reset to 9x9 for clean state
sandbox.GO_STATE.boardSize = 9;
sandbox.resetCurrentGame(false);

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
