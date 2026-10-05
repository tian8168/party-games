const fs = require('fs');
const assert = require('assert');

// Construct full mock browser environment
global.window = global;
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.location = { href: 'http://localhost/games/monopoly/index.html', search: '' };
global.URL = require('url').URL;
global.URLSearchParams = require('url').URLSearchParams;
global.innerWidth = 1200;
global.innerHeight = 800;
global.addEventListener = () => {};
global.removeEventListener = () => {};

const elements = {};
function getOrCreateElem(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      value: id === 'playernumber' ? '4' : (id.includes('name') ? 'Player' : (id.includes('ai') ? '0' : '0')),
      textContent: '',
      innerHTML: '',
      style: {},
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      appendChild(child) {
        return child;
      },
      removeChild() {},
      focus() {}
    };
  }
  return elements[id];
}

global.document = {
  getElementById: (id) => getOrCreateElem(id),
  createElement: (tag) => ({
    tag,
    style: {},
    classList: { add: () => {}, remove: () => {} },
    appendChild: (c) => c,
    removeChild: () => {}
  }),
  addEventListener: () => {}
};

global.$ = function(sel) {
  const obj = {
    length: 1,
    hide: () => obj,
    show: () => obj,
    on: () => obj,
    click: () => obj,
    append: () => obj,
    text: () => obj,
    html: () => obj,
    val: () => '',
    css: () => obj,
    attr: () => obj,
    stop: () => ({ animate: () => obj }),
    prop: () => 100,
    fadeIn: (d, cb) => { if (cb) cb(); return obj; },
    fadeOut: (d, cb) => { if (cb) cb(); return obj; },
    appendTo: () => obj,
    addClass: () => obj,
    removeClass: () => obj,
    scrollTop: () => 0,
    width: () => 100,
    height: () => 100,
    empty: () => obj,
    children: () => obj,
    find: () => obj,
    parent: () => obj,
    focus: () => obj,
    blur: () => obj,
    is: () => false
  };
  return obj;
};
$.stop = () => ({ animate: () => {} });
$.on = () => {};

// Mock Audio
global.window.AUDIO = {
  play: (key) => {},
  toggle: () => true
};

// Mock Network MQTT
let networkMessages = [];
global.window.ONLINE_NETWORK = {
  createRoom: (game) => '1234',
  initMqtt: (roomId, role, onMsg, game) => {},
  joinRoom: (roomId, game) => {},
  sendAction: (data) => {
    networkMessages.push(data);
  },
  setMessageHandler: (handler) => {},
  copyLink: () => {}
};

console.log('--- Loading scripts ---');
require('../games/monopoly/classicedition.js');
require('../games/monopoly/ai.js');
require('../games/monopoly/online.js');
require('../games/monopoly/monopoly.js');

console.log('✓ All 4 script files loaded into runtime without syntax errors.');

// Test 1: window.onload execution
console.log('--- Testing window.onload execution ---');
assert.doesNotThrow(() => {
  window.onload();
}, 'window.onload must execute cleanly without ReferenceError or TypeError');
console.log('✓ window.onload initialized cleanly.');
assert.strictEqual(window.turn, 0, 'turn should be 0 before setup');
assert.strictEqual(window.player.length, 9, 'player array should have 9 slots (0..8)');
assert.strictEqual(window.player[0].name, '银行系统', 'player[0] should be Bank');

// Test 2: Local Game setup
console.log('--- Testing local game setup ---');
assert.doesNotThrow(() => {
  setup();
}, 'setup() must execute cleanly');
console.log('✓ setup() initialized cleanly. Current turn:', window.turn);
assert.strictEqual(window.turn, 1, 'First turn should be player 1');
assert.strictEqual(window.player[1].money, 1500, 'Initial money should be $1500');

// Test 3: Rolling dice, moving and landing
console.log('--- Testing rolling dice and landing ---');
const p1 = window.player[1];
const initialPos = p1.position;
game.setDice(3, 4);
assert.doesNotThrow(() => {
  roll(3, 4);
}, 'roll(3, 4) must execute cleanly');
console.log(`✓ Player rolled 7, moved from ${initialPos} to ${p1.position} (${square[p1.position].name})`);
assert.strictEqual(p1.position, 7, 'Position should be 7 (机会)');

// Test 4: Chance / Community Chest Card Sync
console.log('--- Testing Chance card execution and network sync ---');
chanceCommunityChest();
console.log('✓ Chance card executed cleanly.');

// Test 5: Buying property
console.log('--- Testing Property Purchase ---');
p1.position = 1; // 地中海大道 ($60)
p1.money = 1500;
buy();
assert.strictEqual(square[1].owner, 1, 'Square 1 owner should be player 1');
assert.strictEqual(p1.money, 1440, 'Player 1 money should be $1440');
console.log('✓ Property purchase succeeded. Square 1 owner:', square[1].owner);

// Test 6: Building houses
console.log('--- Testing Building Houses ---');
// Give player 1 all brown group (squares 1 and 3)
square[3].owner = 1;
buyHouse(1);
assert.strictEqual(square[1].house, 1, 'Square 1 should have 1 house');
console.log('✓ Buy house succeeded. Houses on Square 1:', square[1].house);

// Test 7: Mortgaging and Unmortgaging
console.log('--- Testing Mortgage and Unmortgage ---');
sellHouse(1);
mortgage(1);
assert.strictEqual(square[1].mortgage, true, 'Square 1 should be mortgaged');
unmortgage(1);
assert.strictEqual(square[1].mortgage, false, 'Square 1 should be unmortgaged');
console.log('✓ Mortgage and unmortgage verified.');

// Test 8: Resigning and Bankruptcy
console.log('--- Testing Resigning / Bankruptcy liquidation ---');
const prevPcount = pcount;
game.resign(true);
// Resigning eliminates player 1
console.log(`✓ Resignation complete. pcount changed from ${prevPcount} to ${pcount}`);
assert.strictEqual(pcount, prevPcount - 1, 'Player count should decrease by 1');

// Test 9: Online Room Creation and 4-digit code
console.log('--- Testing Online Room Creation ---');
networkMessages = [];
const roomId = MONOPOLY_ONLINE.createRoom(4, 'TestHost');
console.log('✓ Created online room with room code:', roomId);
assert.strictEqual(roomId.length, 4, 'Room code should be 4 digits');
assert.strictEqual(MONOPOLY_ONLINE.state.myRole, 'host', 'Creator role should be host');
assert.strictEqual(MONOPOLY_ONLINE.state.mySlot, 1, 'Host slot should be 1');

// Test 10: Online Action Sync simulation
console.log('--- Testing Online Message Broadcasting ---');
networkMessages = [];
MONOPOLY_ONLINE.broadcastRoll(2, 5);
assert.strictEqual(networkMessages.length, 1);
assert.strictEqual(networkMessages[0].type, 'MONO_ROLL');
assert.strictEqual(networkMessages[0].die1, 2);
assert.strictEqual(networkMessages[0].die2, 5);

MONOPOLY_ONLINE.broadcastCardDraw('chance', 6);
assert.strictEqual(networkMessages[1].type, 'MONO_CARD_DRAW');
assert.strictEqual(networkMessages[1].deck, 'chance');
assert.strictEqual(networkMessages[1].index, 6);

MONOPOLY_ONLINE.broadcastCardAction('chance', 6);
assert.strictEqual(networkMessages[2].type, 'MONO_CARD_ACTION');

MONOPOLY_ONLINE.broadcastSyncState();
assert.strictEqual(networkMessages[3].type, 'MONO_SYNC_STATE');

console.log('✓ All network broadcast types verified.');

console.log('\n===============================================================');
console.log('  🎉 ALL MONOPOLY CORE ENGINE & ONLINE TESTS PASSED 100%! ');
console.log('===============================================================');
