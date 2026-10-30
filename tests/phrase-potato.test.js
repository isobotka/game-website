'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var load = require('./load');
var c = require('./contract');

var PP = load.loadGame('phrase-potato', 'PP');
var R = PP.rules;
var HOST = R.HOST, TIMER = R.TIMER;

c.contract('Phrase Potato', PP, {
  modes: [true, false],
  phases: {
    online: ['lobby', 'ready', 'playing', 'result', 'win'],
    local: ['setup', 'ready', 'playing', 'result', 'win']
  },
  hostOnly: ['SETTINGS', 'START_GAME', 'SET_ORDER', 'SHUFFLE_ORDER', 'START_ROUND', 'NEXT_ROUND', 'END'],
  privileged: [HOST, TIMER],
  hiddenKeys: ['deck', 'idx'],
  mayRemember: ['loser'],  // shown on the result screen; their name just goes blank
  action: function (rand, s) {
    var pick = function (list) { return c.pick(rand, list); };
    return c.weighted(rand, [
      [2, function () { return { type: 'JOIN', name: pick(c.NAMES) }; }],
      [0.3, function () { return { type: 'LEAVE' }; }],
      [0.5, function () { return { type: 'SET_NAME', name: pick(c.NAMES) }; }],
      [3, function () { return { type: 'SET_TEAM', team: pick([0, 1, 2, null]) }; }],
      [1, function () {
        return { type: 'SETTINGS', settings: {
          cats: rand() < 0.8 ? undefined : pick([[], ['nope'], PP.DECK_KEYS.slice(0, 1)]),
          length: pick(['short', 'medium', 'long', 'huge']),
          target: pick([5, 7, 10, 3, '5']),
          mode: pick(['teams', 'solo', 'other']),
          sound: pick([true, false, 'yes'])
        } };
      }],
      // The rules let the host restart at any time, but the screens only offer it before a game.
      [s.phase === 'setup' || s.phase === 'lobby' ? 2 : 0.02, function () { return { type: 'START_GAME' }; }],
      [0.5, function () {
        var team = pick([0, 1, 2]);
        var order = rand() < 0.7 && s.order[team] ? c.shuffled(rand, s.order[team]) : ['p1', 'ghost'];
        return { type: 'SET_ORDER', team: team, order: order };
      }],
      [0.5, function () { return { type: 'SHUFFLE_ORDER' }; }],
      [3, function () { return { type: 'START_ROUND' }; }],
      [4, function () { return { type: 'PASS', from: rand() < 0.7 && s.describer ? s.describer : undefined }; }],
      [1, function () { return { type: 'SKIP', from: rand() < 0.7 && s.describer ? s.describer : undefined }; }],
      [2, function () { return { type: 'BUZZ', from: rand() < 0.8 ? TIMER : undefined }; }],
      [3, function () { return { type: 'NEXT_ROUND' }; }],
      [0.1, function () { return { type: 'END' }; }],
      [0.3, function () { return { type: pick(['NOPE', 'phrase', '']) }; }]
    ]);
  },
  // Only whoever is describing right now sees the phrase.
  secrets: function (s, v, id) {
    if (v.phrase === null) return;
    assert.equal(s.phase, 'playing', id + ' sees the phrase in ' + s.phase);
    if (s.online) assert.equal(id, s.describer, id + ' sees the phrase, but ' + s.describer + ' is describing');
  }
});

// Host and p1 on Teal, p2 and p3 on Magenta, game started.
function teamsGame() {
  return load.play(R, R.newState(true), [
    [HOST, 'JOIN', { name: 'Host' }], ['p1', 'JOIN', { name: 'P1' }],
    ['p2', 'JOIN', { name: 'P2' }], ['p3', 'JOIN', { name: 'P3' }],
    [HOST, 'SET_TEAM', { team: 0 }], ['p1', 'SET_TEAM', { team: 0 }],
    ['p2', 'SET_TEAM', { team: 1 }], ['p3', 'SET_TEAM', { team: 1 }],
    [HOST, 'START_GAME']
  ]);
}

test.describe('Phrase Potato', function () {
  test.it('cleanSettings falls back to the defaults for anything odd', function () {
    var defaults = load.plain(R.cleanSettings(null));
    assert.deepEqual(load.plain(R.cleanSettings({ cats: ['nope'], target: 3, length: 'huge', mode: 'x', sound: 1 })), defaults);
    var ok = { cats: [PP.DECK_KEYS[0]], length: 'short', target: 10, sound: true, mode: 'solo' };
    assert.deepEqual(load.plain(R.cleanSettings(ok)), ok);
  });

  test.it('a game needs both teams online', function () {
    var s = load.play(R, R.newState(true), [[HOST, 'JOIN'], ['p1', 'JOIN'], [HOST, 'SET_TEAM', { team: 0 }]]);
    assert.equal(R.reduce(s, { type: 'START_GAME', from: HOST }), s);
    assert.equal(teamsGame().phase, 'ready');
  });

  test.it('only the describer sees the phrase, and passing hands it to the other team', function () {
    var s = load.play(R, teamsGame(), [[HOST, 'START_ROUND']]);
    assert.equal(s.phase, 'playing');
    assert.equal(s.describer, HOST);
    assert.ok(R.viewFor(s, HOST, 0).phrase);
    ['p1', 'p2', 'p3'].forEach(function (id) { assert.equal(R.viewFor(s, id, 0).phrase, null, id); });

    assert.equal(R.reduce(s, { type: 'PASS', from: 'p1' }), s, 'a teammate cannot pass for the describer');
    s = R.reduce(s, { type: 'PASS', from: HOST });
    assert.equal(s.holding, 1);
    assert.equal(s.describer, 'p2');
    assert.equal(R.viewFor(s, HOST, 0).phrase, null);
    assert.ok(R.viewFor(s, 'p2', 0).phrase);
  });

  test.it('the describer who leaves hands over to the next on their team', function () {
    var s = load.play(R, teamsGame(), [[HOST, 'START_ROUND'], [HOST, 'PASS'], ['p2', 'LEAVE']]);
    assert.equal(s.describer, 'p3');
  });

  test.it('only the timer can buzz, and the team not holding scores', function () {
    var s = load.play(R, teamsGame(), [[HOST, 'START_ROUND'], [HOST, 'PASS']]);
    assert.equal(R.reduce(s, { type: 'BUZZ', from: HOST }), s);
    assert.equal(R.reduce(s, { type: 'BUZZ', from: 'p2' }), s);
    s = R.reduce(s, { type: 'BUZZ', from: TIMER });
    assert.equal(s.phase, 'result');
    assert.deepEqual(load.plain(s.scores), [1, 0]);
    assert.equal(R.viewFor(s, 'p2', 0).phrase, null);
  });

  test.it('the timer counts down from when the round started and stops at 0', function () {
    var s = R.reduce(teamsGame(), { type: 'START_ROUND', from: HOST, now: 10000 });
    assert.equal(R.viewFor(s, HOST, 11000).msLeft, s.roundMs - 1000);
    assert.equal(R.viewFor(s, HOST, 10000 + s.roundMs + 5000).msLeft, 0);
  });

  test.it('one phone: the game ends when a team reaches the target', function () {
    var s = load.play(R, R.newState(false), [[HOST, 'SETTINGS', { settings: { target: 5 } }], [HOST, 'START_GAME']]);
    for (var i = 0; i < 20 && s.phase !== 'win'; i++) {
      s = load.play(R, s, [[HOST, 'START_ROUND'], [TIMER, 'BUZZ'], [HOST, 'NEXT_ROUND']]);
    }
    assert.equal(s.phase, 'win');
    assert.equal(Math.max(s.scores[0], s.scores[1]), 5);
  });

  test.it('solo: the buzz gives the describer a strike', function () {
    var s = load.play(R, R.newState(true), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], [HOST, 'SETTINGS', { settings: { mode: 'solo', target: 5 } }],
      [HOST, 'START_GAME'], [HOST, 'START_ROUND'], [HOST, 'PASS'], [TIMER, 'BUZZ']
    ]);
    assert.equal(s.loser, 'p1');
    assert.deepEqual(load.plain(s.strikes), { host: 0, p1: 1 });
    assert.deepEqual(load.plain(R.viewFor(s, HOST, 0).standings).map(function (p) { return p.id; }), [HOST, 'p1']);
  });

  // Online, a dropped phone comes back through the relay with a new id: a LEAVE, then a new player's JOIN.
  test.it('someone who drops mid-round comes back as a new player, watching until the next game', function () {
    var s = load.play(R, teamsGame(), [[HOST, 'START_ROUND'], ['p1', 'LEAVE'], ['g1', 'JOIN', { name: 'P1' }]]);
    assert.deepEqual(load.plain(s.order), [[HOST], ['p2', 'p3']]);
    var v = R.viewFor(s, 'g1', 0);
    assert.equal(v.myTeam, null);
    assert.equal(v.phrase, null);
    assert.equal(R.reduce(s, { type: 'SET_TEAM', from: 'g1', team: 0 }), s, 'teams are fixed until the game ends');

    s = load.play(R, s, [[HOST, 'PASS'], [TIMER, 'BUZZ'], [HOST, 'NEXT_ROUND'], [HOST, 'START_ROUND']]);
    assert.equal(s.phase, 'playing', 'the game goes on without them');
    assert.notEqual(s.describer, 'g1');

    s = load.play(R, s, [[HOST, 'END'], ['g1', 'SET_TEAM', { team: 0 }], [HOST, 'START_GAME']]);
    assert.deepEqual(load.plain(s.order[0]), [HOST, 'g1'], 'they are in the next game');
  });

  test.it('solo: someone who drops loses their strikes, and comes back with none', function () {
    var s = load.play(R, R.newState(true), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'], [HOST, 'SETTINGS', { settings: { mode: 'solo' } }],
      [HOST, 'START_GAME'], [HOST, 'START_ROUND'], [HOST, 'PASS'], [TIMER, 'BUZZ'],
      ['p1', 'LEAVE'], ['g1', 'JOIN']
    ]);
    assert.deepEqual(load.plain(s.strikes), { host: 0, p2: 0 });
    assert.deepEqual(load.plain(R.viewFor(s, 'g1', 0).standings).map(function (p) { return p.id; }), [HOST, 'p2']);
    s = load.play(R, s, [[HOST, 'NEXT_ROUND'], [HOST, 'START_ROUND']]);
    assert.deepEqual(load.plain(s.order[0]), ['p2', HOST], 'whoever was up next still goes next');
  });
});
