/* Tests every game's rules must pass. shared/net.js relies on all of this:
   newState(online), reduce(state, action) and viewFor(state, id, now), with
   reduce returning the very same state when an action isn't allowed.

   A game's test file calls contract(game, opts):
     modes        which of newState(true) (online) and newState(false) (one phone) exist
     phases       { online: [...], local: [...] } the phases random play must reach
     hostOnly     action types only the host may send
     privileged   senders who may act without joining (the host, a timer)
     action(rand, state)  one random action, { type, ...data }, "from" optional
     secrets(state, view, id)  asserts what player id must not see
     hiddenKeys   state fields that must never be in any view

   The random play tries a few actions per step and keeps the first one the
   rules accept, so games get deep instead of stalling in the lobby. */
'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var load = require('./load');
var seeded = load.seeded, plain = load.plain;

var SEEDS = [1, 2, 3, 4];
var STEPS = 1500;
var TRIES = 12;            // actions tried per step before giving up on it
var MAX_PLAYERS = 16;
var PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function pick(rand, list) { return list[Math.floor(rand() * list.length)]; }

// table: [[weight, makeAction], ...]. Picks one by weight and calls it.
function weighted(rand, table) {
  var total = table.reduce(function (n, row) { return n + row[0]; }, 0);
  var r = rand() * total;
  for (var i = 0; i < table.length - 1; i++) {
    r -= table[i][0];
    if (r < 0) break;
  }
  return table[i][1]();
}

function shuffled(rand, list) {
  var a = list.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Names to join with, including some the rules must clean up.
var NAMES = ['Ann', 'Bo', '  Cy   Dee  ', '', '   ', 'x'.repeat(40), 42, null];

// Anything a reducer can make should survive the trip through the relay as JSON.
function assertPlain(x, where) {
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return;
  if (typeof x === 'number') { assert.ok(isFinite(x), where + ' is ' + x); return; }
  if (Array.isArray(x)) { x.forEach(function (v, i) { assertPlain(v, where + '[' + i + ']'); }); return; }
  assert.equal(Object.prototype.toString.call(x), '[object Object]', where + ' is not plain data');
  Object.keys(x).forEach(function (k) {
    assert.notEqual(x[k], undefined, where + '.' + k + ' is undefined');
    assertPlain(x[k], where + '.' + k);
  });
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
  }
  return o;
}

function contract(name, game, opts) {
  var rules = game.rules;
  var HOST = rules.HOST;
  var privileged = opts.privileged || [HOST];
  var hostOnly = opts.hostOnly || [];
  var hiddenKeys = opts.hiddenKeys || [];

  function isPlayer(s, id) { return s.players.some(function (p) { return p.id === id; }); }

  function checkViews(s, ids, now) {
    ids.forEach(function (id) {
      var v = rules.viewFor(s, id, now);
      assertPlain(v, 'viewFor(' + id + ')');
      hiddenKeys.forEach(function (k) { assert.ok(!(k in v), 'viewFor(' + id + ') has ' + k); });
      if (opts.secrets) opts.secrets(s, v, id);
    });
  }

  function checkState(s) {
    assertPlain(s, 'state');
    var ids = s.players.map(function (p) { return p.id; });
    assert.equal(new Set(ids).size, ids.length, 'duplicate player ids: ' + ids);
    assert.ok(ids.length <= MAX_PLAYERS, ids.length + ' players');
  }

  // One step's rules about who may do what, whatever the game.
  function checkStep(s, a, next) {
    if (next === s) return;
    var label = a.type + ' from ' + a.from;
    if (hostOnly.indexOf(a.type) > -1) assert.equal(a.from, HOST, label + ' was accepted');
    if (!s.online) assert.notEqual(a.type, 'JOIN', 'JOIN was accepted on one phone');
    if (a.type !== 'JOIN' && privileged.indexOf(a.from) < 0) {
      assert.ok(isPlayer(s, a.from), label + ' was accepted from someone who never joined');
    }
  }

  function fuzz(online, seed, seen) {
    var rand = seeded(seed * 7919);
    game.seed(seed);
    var senders = online
      ? privileged.concat(PLAYERS, ['stranger'])
      : privileged;  // one phone: the device is the host, plus any timer
    var s = deepFreeze(rules.newState(online));
    var now = 1000;
    seen.add(s.phase);
    for (var step = 0; step < STEPS; step++) {
      for (var t = 0; t < TRIES; t++) {
        var a = opts.action(rand, s);
        if (a.from === undefined) a.from = pick(rand, senders);
        now += Math.floor(rand() * 5000);
        a.now = now;
        var next;
        try {
          next = rules.reduce(s, a);
          checkStep(s, a, next);
          if (next === s) continue;
          deepFreeze(next);
          checkState(next);
          checkViews(next, senders.concat(next.players.map(function (p) { return p.id; })), now + 500);
        } catch (e) {
          e.message = 'seed ' + seed + ', step ' + step + ', phase ' + s.phase + ', action ' +
            JSON.stringify(a) + ':\n' + e.message;
          throw e;
        }
        s = next;
        seen.add(s.phase);
        break;
      }
    }
  }

  test.describe(name + ' (shared rules contract)', function () {
    (opts.modes || [true]).forEach(function (online) {
      var mode = online ? 'online' : 'one phone';

      test.it(mode + ': newState is plain data with a view for the host', function () {
        var s = rules.newState(online);
        checkState(s);
        assert.equal(s.online, online);
        checkViews(s, [HOST], 0);
      });

      test.it(mode + ': unknown or malformed actions change nothing', function () {
        var s = deepFreeze(rules.newState(online));
        [{ type: 'NOPE', from: HOST }, { from: HOST }, { type: 'toString', from: HOST },
          { type: 'LEAVE', from: 'stranger' }, { type: 'SET_NAME', from: 'stranger', name: 'X' }]
          .forEach(function (a) { assert.equal(rules.reduce(s, a), s, JSON.stringify(a)); });
        hostOnly.forEach(function (type) {
          assert.equal(rules.reduce(s, { type: type, from: 'p1', now: 1 }), s, type + ' from p1');
        });
      });

      test.it(mode + ': random play keeps every rule and reaches every phase', function () {
        var seen = new Set();
        SEEDS.forEach(function (seed) { fuzz(online, seed, seen); });
        var want = opts.phases[online ? 'online' : 'local'];
        var missing = want.filter(function (p) { return !seen.has(p); });
        assert.deepEqual(missing, [], 'random play never reached these phases');
      });
    });

    if ((opts.modes || [true]).indexOf(true) > -1) {
      test.it('online: joining, renaming and leaving', function () {
        var s = rules.newState(true);
        s = rules.reduce(s, { type: 'JOIN', from: 'p1', name: '  Ann   Lee ' });
        s = rules.reduce(s, { type: 'JOIN', from: 'p1', name: 'Ann' });
        assert.equal(s.players.length, 1, 'joining twice adds one player');
        assert.equal(s.players[0].name, 'Ann');

        s = rules.reduce(s, { type: 'JOIN', from: 'p2', name: 'x'.repeat(40) });
        assert.equal(s.players[1].name, 'x'.repeat(16), 'long names are cut');
        s = rules.reduce(s, { type: 'JOIN', from: 'p3', name: '   ' });
        assert.equal(s.players[2].name, 'Player 3', 'blank names get a default');
        s = rules.reduce(s, { type: 'SET_NAME', from: 'p3', name: 42 });
        assert.equal(s.players[2].name, 'Player 3', 'a non-string name is ignored');

        s = rules.reduce(s, { type: 'LEAVE', from: 'p2' });
        assert.deepEqual(plain(s.players).map(function (p) { return p.id; }), ['p1', 'p3']);

        for (var i = 0; s.players.length < MAX_PLAYERS; i++) s = rules.reduce(s, { type: 'JOIN', from: 'x' + i });
        assert.equal(rules.reduce(s, { type: 'JOIN', from: 'late' }), s, 'the room is full');
      });
    }
  });
}

module.exports = { contract: contract, pick: pick, weighted: weighted, shuffled: shuffled, NAMES: NAMES };
