'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var load = require('./load');
var c = require('./contract');

var SS = load.loadGame('spy-spaghetti', 'SS');
var R = SS.rules;
var HOST = R.HOST;

function spyOf(s, t) { return s.players.filter(function (p) { return p.team === t && p.spy; })[0] || null; }

c.contract('Spy Spaghetti', SS, {
  modes: [true],
  phases: { online: ['lobby', 'clue', 'guess', 'win'] },
  hostOnly: ['START_GAME', 'END'],
  action: function (rand, s) {
    var pick = function (list) { return c.pick(rand, list); };
    var spy = spyOf(s, s.active);
    var markers = Object.keys(s.marks);
    return c.weighted(rand, [
      [2, function () { return { type: 'JOIN', name: pick(c.NAMES) }; }],
      [0.3, function () { return { type: 'LEAVE' }; }],
      [0.5, function () { return { type: 'SET_NAME', name: pick(c.NAMES) }; }],
      [3, function () { return { type: 'SET_TEAM', team: pick([0, 1, 2, null]) }; }],
      [3, function () { return { type: 'SET_SPY', on: rand() < 0.7 }; }],
      [2, function () { return { type: 'START_GAME' }; }],
      [4, function () {
        return { type: 'CLUE', count: pick(R.COUNTS.concat([10, '2', -1])), from: rand() < 0.7 && spy ? spy.id : undefined };
      }],
      [6, function () { return { type: 'MARK', card: pick([Math.floor(rand() * 27), '3', -1]) }; }],
      [5, function () { return { type: 'LOCK', from: rand() < 0.7 && markers.length ? pick(markers) : undefined }; }],
      [1, function () { return { type: 'PASS' }; }],
      [0.1, function () { return { type: 'END' }; }],
      [0.3, function () { return { type: pick(['NOPE', 'REVEAL', '']) }; }]
    ]);
  },
  // Until the game is over, only spymasters see the key of a word nobody has picked.
  secrets: function (s, v, id) {
    var me = s.players.filter(function (p) { return p.id === id; })[0];
    var amSpy = !!(me && me.spy && me.team !== null);
    v.cards.forEach(function (card, i) {
      if (card.key === null || s.cards[i].shown || s.phase === 'win') return;
      assert.ok(amSpy, id + ' sees the key of "' + card.word + '" without being a spymaster');
    });
  }
});

// Host spymaster and p1 on Teal, p2 spymaster and p3 on Magenta, game started.
function game() {
  return load.play(R, R.newState(), [
    [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'], ['p3', 'JOIN'],
    [HOST, 'SET_TEAM', { team: 0 }], ['p1', 'SET_TEAM', { team: 0 }],
    ['p2', 'SET_TEAM', { team: 1 }], ['p3', 'SET_TEAM', { team: 1 }],
    [HOST, 'SET_SPY', { on: true }], ['p2', 'SET_SPY', { on: true }],
    [HOST, 'START_GAME']
  ]);
}
function spyId(s) { return s.active === 0 ? HOST : 'p2'; }
function operativeId(s) { return s.active === 0 ? 'p1' : 'p3'; }
function cardWith(s, key) {
  for (var i = 0; i < s.cards.length; i++) if (s.cards[i].key === key && !s.cards[i].shown) return i;
  return -1;
}
function pickCard(s, i) {
  return load.play(R, s, [[operativeId(s), 'MARK', { card: i }], [operativeId(s), 'LOCK']]);
}

test.describe('Spy Spaghetti', function () {
  test.it('each team needs a spymaster and an operative to start', function () {
    var s = load.play(R, R.newState(), [
      [HOST, 'JOIN'], ['p1', 'JOIN'], ['p2', 'JOIN'],
      [HOST, 'SET_TEAM', { team: 0 }], ['p1', 'SET_TEAM', { team: 0 }], ['p2', 'SET_TEAM', { team: 1 }],
      [HOST, 'SET_SPY', { on: true }], ['p2', 'SET_SPY', { on: true }]
    ]);
    assert.equal(R.reduce(s, { type: 'START_GAME', from: HOST }), s);
    assert.equal(game().phase, 'clue');
  });

  test.it('deals 9 agents to the team that starts, 8 to the other, 1 assassin, 7 bystanders', function () {
    var s = game();
    var count = function (k) { return s.cards.filter(function (card) { return card.key === k; }).length; };
    assert.equal(s.cards.length, 25);
    assert.equal(new Set(s.cards.map(function (card) { return card.word; })).size, 25, 'no word twice');
    assert.equal(count(s.start), 9);
    assert.equal(count(1 - s.start), 8);
    assert.equal(count('x'), 1);
    assert.equal(count('n'), 7);
    assert.equal(s.active, s.start);
  });

  test.it('spymasters see the key, operatives do not', function () {
    var s = game();
    [HOST, 'p2'].forEach(function (id) {
      assert.ok(R.viewFor(s, id).cards.every(function (card) { return card.key !== null; }), id);
    });
    ['p1', 'p3', 'stranger'].forEach(function (id) {
      assert.ok(R.viewFor(s, id).cards.every(function (card) { return card.key === null; }), id);
    });
  });

  test.it('only the active spymaster gives a clue, with a number on the list', function () {
    var s = game();
    var other = s.active === 0 ? 'p2' : HOST;
    assert.equal(R.reduce(s, { type: 'CLUE', from: other, count: 2 }), s);
    assert.equal(R.reduce(s, { type: 'CLUE', from: operativeId(s), count: 2 }), s);
    assert.equal(R.reduce(s, { type: 'CLUE', from: spyId(s), count: 10 }), s);
    assert.equal(R.reduce(s, { type: 'CLUE', from: spyId(s), count: '2' }), s);
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 2 });
    assert.equal(s.phase, 'guess');
    assert.equal(s.left, 3, 'one more pick than the number');
    s = R.reduce(load.plain(game()), { type: 'CLUE', from: spyId(s), count: 'inf' });
    assert.equal(s.left, null);
  });

  test.it('a spymaster cannot pick words while their team has operatives', function () {
    var s = game();
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 1 });
    assert.equal(R.reduce(s, { type: 'MARK', from: spyId(s), card: 0 }), s);
  });

  test.it('a wrong pick ends the turn', function () {
    var s = game();
    var first = s.active;
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 1 });
    s = pickCard(s, cardWith(s, 'n'));
    assert.equal(s.phase, 'clue');
    assert.equal(s.active, 1 - first);
  });

  test.it('picking the assassin loses, and then everyone sees the key', function () {
    var s = game();
    var first = s.active;
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 1 });
    s = pickCard(s, cardWith(s, 'x'));
    assert.equal(s.phase, 'win');
    assert.equal(s.winner, 1 - first);
    assert.equal(s.reason, 'assassin');
    assert.ok(R.viewFor(s, 'p1').cards.every(function (card) { return card.key !== null; }));
  });

  test.it('finding all your agents wins', function () {
    var s = game();
    var team = s.active;
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 'inf' });
    while (s.phase === 'guess') s = pickCard(s, cardWith(s, team));
    assert.equal(s.phase, 'win');
    assert.equal(s.winner, team);
    assert.equal(s.reason, 'agents');
  });

  test.it('mid-game, a spymaster can neither step down nor switch teams', function () {
    var s = game();
    assert.equal(R.reduce(s, { type: 'SET_SPY', from: HOST, on: false }), s);
    assert.equal(R.reduce(s, { type: 'SET_TEAM', from: HOST, team: 1 }), s);
  });

  test.it('when a spymaster leaves, a teammate can take the seat', function () {
    var s = game();
    var team = s.active;
    s = R.reduce(s, { type: 'LEAVE', from: spyId(s) });
    assert.ok(R.viewFor(s, 'p1').needSpy);
    s = R.reduce(s, { type: 'SET_SPY', from: operativeId(s), on: true });
    assert.equal(spyOf(s, team).id, operativeId(s));
  });

  // Online, a dropped phone comes back through the relay with a new id: a LEAVE, then a new player's JOIN.
  test.it('an operative who drops can come back as a new player and pick a team mid-game', function () {
    var s = game();
    var team = s.active;
    s = R.reduce(s, { type: 'CLUE', from: spyId(s), count: 2 });
    s = load.play(R, s, [[operativeId(s), 'MARK', { card: 0 }], [operativeId(s), 'LEAVE']]);
    assert.deepEqual(load.plain(s.marks), {}, 'their mark goes with them');
    assert.ok(R.viewFor(s, spyId(s)).canMark, 'with no operatives left, the spymaster picks');

    s = load.play(R, s, [['g1', 'JOIN'], ['g1', 'SET_TEAM', { team: team }]]);
    var v = R.viewFor(s, 'g1');
    assert.ok(v.canMark);
    assert.ok(v.cards.every(function (card) { return card.shown || card.key === null; }), 'a new operative sees no key');
    assert.ok(!R.viewFor(s, spyId(s)).canMark, 'the spymaster hands picking back');
    assert.equal(R.reduce(s, { type: 'SET_TEAM', from: 'g1', team: 1 - team }), s, 'and then they cannot switch');
  });

  test.it('a spymaster who drops can come back and take their seat again', function () {
    var s = game();
    var team = s.active;
    s = load.play(R, s, [[spyId(s), 'LEAVE'], ['g1', 'JOIN'], ['g1', 'SET_TEAM', { team: team }], ['g1', 'SET_SPY', { on: true }]]);
    assert.equal(spyOf(s, team).id, 'g1');
    assert.ok(R.viewFor(s, 'g1').cards.every(function (card) { return card.key !== null; }));
    s = R.reduce(s, { type: 'CLUE', from: 'g1', count: 1 });
    assert.equal(s.phase, 'guess');
  });

  test.it('an open spymaster seat goes to whoever takes it first, and only on their own team', function () {
    var s = game();
    s = load.play(R, s, [
      ['p2', 'LEAVE'], ['g1', 'JOIN'], ['g2', 'JOIN'],
      ['g1', 'SET_TEAM', { team: 1 }], ['g2', 'SET_TEAM', { team: 1 }], ['g1', 'SET_SPY', { on: true }]
    ]);
    assert.equal(spyOf(s, 1).id, 'g1');
    assert.equal(R.reduce(s, { type: 'SET_SPY', from: 'g2', on: true }), s, 'the seat is taken');
    assert.equal(R.reduce(s, { type: 'SET_SPY', from: 'g1', on: false }), s, 'they have seen the key, so they stay');

    s = load.play(R, s, [['g3', 'JOIN'], ['g3', 'SET_TEAM', { team: 0 }]]);
    assert.equal(R.reduce(s, { type: 'SET_SPY', from: 'g3', on: true }), s, "Teal's seat is not open");
  });

  test.it('an operative taking the open seat loses their mark', function () {
    var s = load.play(R, game(), [[HOST, 'LEAVE']]);
    s = load.play(R, s, [['p1', 'MARK', { card: 0 }]]);
    if (s.active !== 0) s = load.play(R, s, [['p2', 'CLUE', { count: 1 }], ['p3', 'MARK', { card: 0 }], ['p3', 'LOCK']]);
    // Teal has no spymaster, so give p1 the seat whether or not Teal is guessing.
    s = R.reduce(s, { type: 'SET_SPY', from: 'p1', on: true });
    assert.equal(spyOf(s, 0).id, 'p1');
    assert.ok(!('p1' in s.marks));
  });
});
