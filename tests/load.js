/* Loads a game's rules into Node the way the page does: decks.js, then rules.js,
   both writing to window.XX. Math.random is seeded so every run plays the same
   games, and a failure can be replayed. */
'use strict';

var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

var ROOT = path.join(__dirname, '..');

// mulberry32: small, fast and good enough for shuffling test games.
function seeded(seed) {
  var t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    var r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// loadGame('phrase-potato', 'PP') -> window.PP, with .seed(n) to reset Math.random.
function loadGame(dir, ns) {
  var ctx = vm.createContext({ window: {} });
  ['decks.js', 'rules.js'].forEach(function (file) {
    var full = path.join(ROOT, dir, file);
    vm.runInContext(fs.readFileSync(full, 'utf8'), ctx, { filename: full });
  });
  var game = ctx.window[ns];
  var math = vm.runInContext('Math', ctx);
  game.seed = function (n) { math.random = seeded(n); };
  game.seed(1);
  return game;
}

// Plain copy of something made inside the vm, so deepStrictEqual can compare it.
function plain(x) { return JSON.parse(JSON.stringify(x)); }

// Runs actions in order, filling in "now" the way the session does.
// steps: [[from, type, data], ...]
function play(rules, state, steps) {
  steps.forEach(function (step, i) {
    var a = Object.assign({}, step[2], { type: step[1], from: step[0], now: 1000 * (i + 1) });
    state = rules.reduce(state, a);
  });
  return state;
}

module.exports = { loadGame: loadGame, plain: plain, play: play, seeded: seeded };
