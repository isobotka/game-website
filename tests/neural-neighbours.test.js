'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var load = require('./load');
var c = require('./contract');

var NN = load.loadGame('neural-neighbours', 'NN');
var R = NN.rules;
var HOST = R.HOST;

function isSolo(s) { return s.online && s.settings.mode === 'solo'; }

c.contract('Neural Neighbours', NN, {
  modes: [true, false],
  phases: {
    online: ['lobby', 'ready', 'clue', 'guess', 'steal', 'reveal', 'win'],
    local: ['setup', 'ready', 'clue', 'guess', 'steal', 'reveal', 'win']
  },
  hostOnly: ['SETTINGS', 'START_GAME', 'SET_ORDER', 'SHUFFLE_ORDER', 'START_ROUND', 'REVEAL', 'NEXT_ROUND', 'END'],
  hiddenKeys: ['deck', 'guesses'],
  mayRemember: ['psychic', 'result'],  // what the reveal screen shows; the round is over by then
  action: function (rand, s) {
    var pick = function (list) { return c.pick(rand, list); };
    // Sometimes aim near the target, so games get to the end.
    var dial = function () {
      return rand() < 0.4 ? s.target + rand() * 10 - 5 : pick([rand() * 120 - 10, NaN, Infinity, '50', null]);
    };
    var guessers = Object.keys(s.guesses);
    return c.weighted(rand, [
      [2, function () { return { type: 'JOIN', name: pick(c.NAMES) }; }],
      [0.3, function () { return { type: 'LEAVE' }; }],
      [0.5, function () { return { type: 'SET_NAME', name: pick(c.NAMES) }; }],
      [3, function () { return { type: 'SET_TEAM', team: pick([0, 1, 2, null]) }; }],
      [1, function () {
        return { type: 'SETTINGS', settings: {
          mode: pick(['teams', 'solo', 'other']), target: pick([5, 10, 15, 3]), laps: pick([1, 2, 3, 0])
        } };
      }],
      // The rules let the host restart at any time, but the screens only offer it before and after a game.
      [s.phase === 'setup' || s.phase === 'lobby' || s.phase === 'win' ? 2 : 0.02, function () { return { type: 'START_GAME' }; }],
      [0.5, function () {
        var group = pick([0, 1, 2]);
        var order = rand() < 0.7 && s.queue[group] ? c.shuffled(rand, s.queue[group]) : ['p1', 'ghost'];
        return { type: 'SET_ORDER', group: group, order: order };
      }],
      [0.5, function () { return { type: 'SHUFFLE_ORDER' }; }],
      [3, function () { return { type: 'START_ROUND' }; }],
      [1, function () { return { type: 'PEEK', on: rand() < 0.5 }; }],
      [3, function () { return { type: 'CLUE_GIVEN', from: rand() < 0.7 && s.psychic ? s.psychic : undefined }; }],
      [2, function () { return { type: 'SET_DIAL', value: dial() }; }],
      [4, function () {
        return { type: 'LOCK', value: dial(), from: rand() < 0.7 && guessers.length ? pick(guessers) : undefined };
      }],
      [0.5, function () { return { type: 'REVEAL' }; }],
      [3, function () { return { type: 'STEAL', side: pick(['left', 'right', 'up']) }; }],
      [3, function () { return { type: 'NEXT_ROUND' }; }],
      [0.1, function () { return { type: 'END' }; }],
      [0.3, function () { return { type: pick(['NOPE', 'target', '']) }; }]
    ]);
  },
  secrets: function (s, v, id) {
    var revealed = s.phase === 'reveal' || s.phase === 'win';
    // The target: only the psychic (or, on one phone, while peeking) before the reveal.
    if (v.target !== null && !revealed) {
      if (s.online) assert.equal(id, s.psychic, id + ' sees the target in ' + s.phase);
      else assert.ok(s.peek, 'the target shows on one phone without peeking');
    }
    if (!revealed) assert.equal(v.result, null, id + ' sees the result in ' + s.phase);
    // Solo: nobody sees anyone else's dial before the reveal.
    if (isSolo(s)) {
      var mine = s.guesses[id];
      assert.equal(v.dial, mine ? mine.value : null, id + ' sees a dial that is not theirs');
      if (!revealed) v.guessers.forEach(function (g) { assert.equal(g.value, null, id + ' sees ' + g.id + "'s dial"); });
    }
  }
});

// Host and p1 on Teal, p2 and p3 on Magenta, first round started: the host is the psychic.
function teamsRound() {
  return load.play(R, R.newState(true), [
    [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'], ['p3', 'JOIN'],
    [HOST, 'SET_TEAM', { team: 0 }], ['p1', 'SET_TEAM', { team: 0 }],
    ['p2', 'SET_TEAM', { team: 1 }], ['p3', 'SET_TEAM', { team: 1 }],
    [HOST, 'START_GAME'], [HOST, 'START_ROUND']
  ]);
}

test.describe('Neural Neighbours', function () {
  test.it('pointsFor: 4 for a bullseye, then 2, then 1', function () {
    [[50, 4], [52.5, 4], [47.5, 4], [53, 2], [60, 2], [61, 1], [67.5, 1], [68, 0], [0, 0]].forEach(function (row) {
      assert.equal(R.pointsFor(row[0], 50), row[1], 'guess ' + row[0]);
    });
  });

  test.it('teams need two players each online', function () {
    var s = load.play(R, R.newState(true), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'],
      [HOST, 'SET_TEAM', { team: 0 }], ['p1', 'SET_TEAM', { team: 0 }], ['p2', 'SET_TEAM', { team: 1 }]
    ]);
    assert.equal(R.reduce(s, { type: 'START_GAME', from: HOST }), s);
  });

  test.it('the target is hidden from everyone but the psychic until the reveal', function () {
    var s = teamsRound();
    assert.equal(s.psychic, HOST);
    assert.equal(s.phase, 'clue');
    assert.equal(R.viewFor(s, HOST).target, s.target);
    ['p1', 'p2', 'p3'].forEach(function (id) { assert.equal(R.viewFor(s, id).target, null, id); });
  });

  test.it('a full teams round: clue, dial, lock, steal, score', function () {
    var s = teamsRound();
    assert.equal(R.reduce(s, { type: 'CLUE_GIVEN', from: 'p1' }), s, 'only the psychic says the clue is given');
    s = R.reduce(s, { type: 'CLUE_GIVEN', from: HOST });
    assert.equal(s.phase, 'guess');

    assert.equal(R.reduce(s, { type: 'SET_DIAL', from: HOST, value: 10 }), s, 'the psychic has a teammate to turn it');
    assert.equal(R.reduce(s, { type: 'SET_DIAL', from: 'p2', value: 10 }), s, 'the other team cannot turn it');
    assert.equal(R.reduce(s, { type: 'SET_DIAL', from: 'p1', value: 500 }).dial, 100, 'the dial stops at 100');

    s = R.reduce(s, { type: 'LOCK', from: 'p1', value: s.target });
    assert.equal(s.phase, 'steal');
    assert.equal(R.reduce(s, { type: 'STEAL', from: 'p1', side: 'left' }), s, 'the guessing team cannot steal');
    s = R.reduce(s, { type: 'STEAL', from: 'p2', side: 'left' });
    assert.equal(s.phase, 'reveal');
    assert.deepEqual(load.plain(s.scores), [4, 0]);
    assert.equal(R.viewFor(s, 'p2').target, s.target, 'everyone sees the target after the reveal');

    s = R.reduce(s, { type: 'NEXT_ROUND', from: HOST });
    s = R.reduce(s, { type: 'START_ROUND', from: HOST });
    assert.equal(s.active, 1);
    assert.equal(s.psychic, 'p2', 'the other team has the next psychic');
  });

  test.it('the game ends at the target, but not on a tie', function () {
    var s = load.play(R, teamsRound(), [[HOST, 'CLUE_GIVEN']]);
    var near = load.plain(s);
    near.scores = [9, 0];
    var won = load.play(R, near, [['p1', 'LOCK', { value: near.target }], ['p2', 'STEAL', { side: 'left' }]]);
    assert.ok(won.over);
    assert.equal(R.reduce(won, { type: 'NEXT_ROUND', from: HOST }).phase, 'win');

    var tie = load.plain(s);
    tie.scores = [6, 9];
    tie.target = 50;
    tie = load.play(R, tie, [['p1', 'LOCK', { value: 49 }], ['p2', 'STEAL', { side: 'right' }]]);
    assert.deepEqual(load.plain(tie.scores), [10, 10]);
    assert.equal(tie.over, false);
  });

  test.it('the psychic leaving mid-round goes back to the ready screen', function () {
    var s = R.reduce(teamsRound(), { type: 'LEAVE', from: HOST });
    assert.equal(s.phase, 'ready');
    assert.equal(s.psychic, null);
  });

  test.it('solo: dials stay secret, and the round reveals once everyone locks in', function () {
    var s = load.play(R, R.newState(true), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'],
      [HOST, 'SETTINGS', { settings: { mode: 'solo' } }],
      [HOST, 'START_GAME'], [HOST, 'START_ROUND'], [HOST, 'CLUE_GIVEN']
    ]);
    assert.equal(s.psychic, HOST);
    s.target = 50;
    s = R.reduce(s, { type: 'LOCK', from: 'p1', value: 50 });
    var p2 = R.viewFor(s, 'p2');
    assert.equal(p2.dial, 50, 'p2 sees their own dial');
    assert.deepEqual(load.plain(p2.guessers).map(function (g) { return [g.id, g.locked, g.value]; }),
      [['p1', true, null], ['p2', false, null]]);

    s = R.reduce(s, { type: 'LOCK', from: 'p2', value: 60 });
    assert.equal(s.phase, 'reveal');
    assert.deepEqual(load.plain(s.result), { guesses: { p1: 4, p2: 2 }, psychic: 3 });
    assert.deepEqual(load.plain(s.points), { host: 3, p1: 4, p2: 2 });
  });

  // Online, a dropped phone comes back through the relay with a new id: a LEAVE, then a new player's JOIN.
  test.it('someone who drops mid-round comes back as a new player, watching until the next game', function () {
    var s = load.play(R, teamsRound(), [[HOST, 'CLUE_GIVEN'], ['p3', 'LEAVE'], ['g1', 'JOIN', { name: 'P3' }]]);
    var v = R.viewFor(s, 'g1');
    assert.equal(v.myTeam, null);
    assert.equal(v.target, null);
    assert.ok(!v.canTurn);
    assert.equal(R.reduce(s, { type: 'SET_TEAM', from: 'g1', team: 1 }), s, 'teams are fixed until the game ends');

    s = load.play(R, s, [['p1', 'LOCK', { value: 50 }]]);
    assert.ok(!R.viewFor(s, 'g1').canSteal);
    s = load.play(R, s, [['p2', 'STEAL', { side: 'left' }], [HOST, 'NEXT_ROUND']]);
    assert.deepEqual(load.plain(s.queue), [['p1'], ['p2']], 'they are not in the psychic order');

    s = load.play(R, s, [[HOST, 'END'], ['g1', 'SET_TEAM', { team: 1 }], [HOST, 'START_GAME']]);
    assert.deepEqual(load.plain(s.queue[1]), ['p2', 'g1'], 'they are in the next game');
  });

  test.it('solo: when a guesser drops and everyone left has locked in, the round reveals', function () {
    var s = load.play(R, R.newState(true), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'], [HOST, 'SETTINGS', { settings: { mode: 'solo' } }],
      [HOST, 'START_GAME'], [HOST, 'START_ROUND'], [HOST, 'CLUE_GIVEN'],
      ['p1', 'LOCK', { value: 50 }], ['p2', 'LEAVE']
    ]);
    assert.equal(s.phase, 'reveal');
    assert.deepEqual(Object.keys(s.result.guesses), ['p1']);

    s = load.play(R, s, [['g1', 'JOIN'], [HOST, 'NEXT_ROUND'], [HOST, 'START_ROUND']]);
    assert.equal(s.psychic, 'p1');
    assert.deepEqual(Object.keys(s.guesses), [HOST], 'a newcomer does not guess until the next game');
    assert.ok(!R.viewFor(s, 'g1').canTurn);
  });
});
