/* Spy Spaghetti: the game rules. No DOM, no network, no timers.

   25 words are dealt onto a board. Each team has a spymaster, who sees which
   words are their team's agents, and operatives, who don't. The spymaster
   says a one-word clue and a number out loud, then the operatives pick words.
   Their own agent: keep going. Anything else ends the turn, and the assassin
   loses the game. First team to find all their agents wins.

   reduce(state, action) returns the next state, or the same state if the action
   is not allowed. It only runs on the host's device; everyone else gets a view
   of the result. */
(function (SS) {
  'use strict';

  var TEAMS = [{ name: 'Teal', cls: 't0' }, { name: 'Magenta', cls: 't1' }];
  var COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'inf']; // what a spymaster may say after the clue
  var SIZE = 25, FIRST = 9, SECOND = 8, ASSASSINS = 1; // the rest are bystanders
  var HOST = 'host';          // the host's player id
  var MAX_PLAYERS = 16;

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function cleanName(name, fallback) {
    var n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    return n || fallback;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- players ---------- */
  function findPlayer(s, id) {
    for (var i = 0; i < s.players.length; i++) if (s.players[i].id === id) return s.players[i];
    return null;
  }
  function teamOf(s, t) { return s.players.filter(function (p) { return p.team === t; }); }
  function spyOf(s, t) {
    for (var i = 0; i < s.players.length; i++) if (s.players[i].team === t && s.players[i].spy) return s.players[i];
    return null;
  }
  function operatives(s, t) { return teamOf(s, t).filter(function (p) { return !p.spy; }); }

  function canStart(s) {
    return [0, 1].every(function (t) { return !!spyOf(s, t) && operatives(s, t).length >= 1; });
  }

  // Who picks words this turn: the active team's operatives. The spymaster only
  // may if every operative on their team has left.
  function canGuess(s, id) {
    var p = findPlayer(s, id);
    if (!p || p.team !== s.active || s.phase !== 'guess') return false;
    return !p.spy || operatives(s, s.active).length === 0;
  }

  /* ---------- the board ---------- */
  // key: 0 or 1 for a team's agent, 'n' for a bystander, 'x' for the assassin.
  function deal(s) {
    var words = shuffle(SS.WORDS.slice()).slice(0, SIZE);
    var keys = [];
    var i;
    for (i = 0; i < FIRST; i++) keys.push(s.start);
    for (i = 0; i < SECOND; i++) keys.push(1 - s.start);
    for (i = 0; i < ASSASSINS; i++) keys.push('x');
    while (keys.length < SIZE) keys.push('n');
    shuffle(keys);
    s.cards = words.map(function (w, j) { return { word: w, key: keys[j], shown: false }; });
  }
  function remaining(s, t) {
    return s.cards.filter(function (c) { return c.key === t && !c.shown; }).length;
  }

  /* ---------- state ---------- */
  function newState() {
    return {
      online: true,
      phase: 'lobby',             // lobby | clue | guess | win
      players: [],                // [{ id, name, team: 0 | 1 | null, spy }]
      cards: [],                  // [{ word, key, shown }]
      start: 0, active: 0,        // start: the team with 9 agents, who goes first
      count: null,                // the number with this turn's clue
      left: null,                 // picks left this turn; null for no limit
      guessed: 0,                 // picks made this turn
      marks: {},                  // player id -> card index they want to pick
      log: [],                    // [{ team, count, picks: [{ word, key }] }]
      winner: null, reason: null  // reason: 'agents' | 'assassin'
    };
  }

  function endTurn(s) {
    s.marks = {};
    s.active = 1 - s.active;
    s.count = null;
    s.left = null;
    s.guessed = 0;
    s.phase = 'clue';
  }
  function win(s, team, reason) {
    s.marks = {};
    s.winner = team;
    s.reason = reason;
    s.phase = 'win';
  }

  function reveal(s, i) {
    var card = s.cards[i];
    card.shown = true;
    s.guessed += 1;
    for (var id in s.marks) if (s.marks[id] === i) delete s.marks[id];
    var entry = s.log[s.log.length - 1];
    if (entry) entry.picks.push({ word: card.word, key: card.key });

    if (card.key === 'x') return win(s, 1 - s.active, 'assassin');
    // A pick can finish either team's agents.
    if (!remaining(s, s.active)) return win(s, s.active, 'agents');
    if (!remaining(s, 1 - s.active)) return win(s, 1 - s.active, 'agents');
    if (card.key !== s.active) return endTurn(s);
    if (s.left !== null) {
      s.left -= 1;
      if (s.left <= 0) endTurn(s);
    }
  }

  function dropPlayer(s, id) {
    s.players = s.players.filter(function (p) { return p.id !== id; });
    delete s.marks[id];
  }

  // action: { type, from, ...data }. "from" is filled in by the session, never
  // trusted from the sender.
  function reduce(state, a) {
    var s = clone(state);
    var isHost = a.from === HOST;
    var me = findPlayer(s, a.from);
    var playing = s.phase === 'clue' || s.phase === 'guess';

    switch (a.type) {
      case 'JOIN':
        if (me) { me.name = cleanName(a.name, me.name); return s; }
        if (s.players.length >= MAX_PLAYERS) return state;
        s.players.push({ id: a.from, name: cleanName(a.name, 'Player ' + (s.players.length + 1)), team: null, spy: false });
        return s;

      case 'LEAVE':
        if (!me) return state;
        dropPlayer(s, a.from);
        return s;

      case 'SET_NAME':
        if (!me) return state;
        me.name = cleanName(a.name, me.name);
        return s;

      // In the lobby anyone may switch. Once the game is on, only someone without
      // a team may pick one: switching would carry what they know across.
      case 'SET_TEAM':
        if (!me || (a.team !== 0 && a.team !== 1) || me.team === a.team) return state;
        if (s.phase !== 'lobby' && s.phase !== 'win' && me.team !== null) return state;
        me.team = a.team;
        me.spy = false;
        return s;

      // Taking the spymaster's seat needs it free. Mid-game that only happens when
      // the spymaster left; giving it up mid-game isn't allowed (they've seen the key).
      case 'SET_SPY':
        if (!me || me.team === null) return state;
        if (a.on) {
          if (me.spy || spyOf(s, me.team)) return state;
          me.spy = true;
          delete s.marks[a.from];
        } else {
          if (!me.spy || playing) return state;
          me.spy = false;
        }
        return s;

      case 'START_GAME':
        if (!isHost || !canStart(s) || playing) return state;
        s.start = Math.random() < 0.5 ? 0 : 1;
        s.active = s.start;
        deal(s);
        s.count = null;
        s.left = null;
        s.guessed = 0;
        s.marks = {};
        s.log = [];
        s.winner = null;
        s.reason = null;
        s.phase = 'clue';
        return s;

      case 'CLUE': {
        var spy = spyOf(s, s.active);
        if (s.phase !== 'clue' || !spy || spy.id !== a.from || COUNTS.indexOf(a.count) < 0) return state;
        s.count = a.count;
        // The usual rule: one more pick than the number. 0 or unlimited: no limit.
        s.left = a.count === 'inf' || a.count === 0 ? null : a.count + 1;
        s.guessed = 0;
        s.log.push({ team: s.active, count: a.count, picks: [] });
        s.phase = 'guess';
        return s;
      }

      case 'MARK': {
        var i = a.card;
        if (!canGuess(s, a.from) || typeof i !== 'number' || !s.cards[i] || s.cards[i].shown) return state;
        if (s.marks[a.from] === i) delete s.marks[a.from];
        else s.marks[a.from] = i;
        return s;
      }

      case 'LOCK':
        if (!canGuess(s, a.from) || !has(s.marks, a.from)) return state;
        reveal(s, s.marks[a.from]);
        return s;

      case 'PASS':
        if (!canGuess(s, a.from) || s.guessed < 1) return state;
        endTurn(s);
        return s;

      case 'END':
        if (!isHost) return state;
        s.marks = {};
        s.phase = 'lobby';
        return s;
    }
    return state;
  }

  // What one player is allowed to see. Only spymasters see the key, until the
  // game is over.
  function viewFor(s, id) {
    var me = findPlayer(s, id);
    var amSpy = !!(me && me.spy && me.team !== null);
    var over = s.phase === 'win';
    var playing = s.phase === 'clue' || s.phase === 'guess';
    var spy = spyOf(s, s.active);
    var marks = {};
    Object.keys(s.marks).forEach(function (pid) {
      var p = findPlayer(s, pid);
      if (!p) return;
      var i = s.marks[pid];
      (marks[i] = marks[i] || []).push({ id: pid, name: p.name });
    });

    return {
      online: true,
      phase: s.phase,
      players: s.players,
      me: id,
      isHost: id === HOST,
      myTeam: me ? me.team : null,
      amSpy: amSpy,
      canStart: canStart(s),
      spies: [spyOf(s, 0), spyOf(s, 1)].map(function (p) { return p ? { id: p.id, name: p.name } : null; }),
      start: s.start,
      active: s.active,
      cards: s.cards.map(function (c) {
        return { word: c.word, shown: c.shown, key: c.shown || amSpy || over ? c.key : null };
      }),
      remaining: [remaining(s, 0), remaining(s, 1)],
      count: s.count,
      left: s.left,
      guessed: s.guessed,
      marks: marks,
      myMark: me && has(s.marks, id) ? s.marks[id] : null,
      canClue: s.phase === 'clue' && !!spy && spy.id === id,
      canMark: canGuess(s, id),
      canPass: canGuess(s, id) && s.guessed > 0,
      needSpy: playing && !spy,
      log: s.log,
      winner: s.winner,
      reason: s.reason
    };
  }

  SS.rules = {
    TEAMS: TEAMS, COUNTS: COUNTS, HOST: HOST,
    newState: newState, reduce: reduce, viewFor: viewFor
  };
})(window.SS = window.SS || {});
