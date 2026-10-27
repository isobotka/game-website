/* Phrase Potato: the game rules. No DOM, no network, no timers.

   reduce(state, action) returns the next state, or the same state if the action
   is not allowed. In local play it runs on the one phone; online it only runs
   on the host's device, and everyone else gets a view of the result. */
(function (PP) {
  'use strict';

  var LENGTHS = { short: [30, 50], medium: [45, 75], long: [60, 100] };
  var TARGETS = [5, 7, 10];
  var TEAMS = [{ name: 'Teal', cls: 't0' }, { name: 'Magenta', cls: 't1' }];
  var HOST = 'host';     // the host's player id, also the single device in local play
  var TIMER = '@timer';  // sender of the buzzer, only the host's timer uses it
  var MAX_PLAYERS = 16;

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function cleanSettings(s) {
    var out = { cats: PP.DECK_KEYS.slice(), length: 'medium', target: 7, sound: true };
    if (!s || typeof s !== 'object') return out;
    if (Array.isArray(s.cats)) {
      var cats = s.cats.filter(function (k) { return typeof k === 'string' && has(PP.DECKS, k); });
      if (cats.length) out.cats = cats;
    }
    if (typeof s.length === 'string' && has(LENGTHS, s.length)) out.length = s.length;
    if (TARGETS.indexOf(s.target) > -1) out.target = s.target;
    if (typeof s.sound === 'boolean') out.sound = s.sound;
    return out;
  }

  function cleanName(name, fallback) {
    var n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    return n || fallback;
  }

  function deckSize(settings) {
    var n = 0;
    settings.cats.forEach(function (k) { n += PP.DECKS[k].items.length; });
    return n;
  }

  /* ---------- deck ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function buildDeck(settings) {
    var d = [];
    settings.cats.forEach(function (k) {
      PP.DECKS[k].items.forEach(function (text) { d.push({ text: text, cat: PP.DECKS[k].label }); });
    });
    return shuffle(d);
  }
  function nextPhrase(s) {
    if (s.idx >= s.deck.length) { s.deck = buildDeck(s.settings); s.idx = 0; }
    s.phrase = s.deck[s.idx++];
  }

  /* ---------- players ---------- */
  function findPlayer(s, id) {
    for (var i = 0; i < s.players.length; i++) if (s.players[i].id === id) return s.players[i];
    return null;
  }
  function teamOf(s, t) { return s.players.filter(function (p) { return p.team === t; }); }

  // The next describer on team t, taking turns in join order.
  function pickDescriber(s, t) {
    if (!s.online) return null;
    var members = teamOf(s, t);
    if (!members.length) return null;
    var p = members[s.turn[t] % members.length];
    s.turn[t] += 1;
    return p.id;
  }

  function canStart(s) {
    if (deckSize(s.settings) === 0) return false;
    return !s.online || (teamOf(s, 0).length > 0 && teamOf(s, 1).length > 0);
  }

  /* ---------- state ---------- */
  function newState(online) {
    return {
      online: online,
      phase: online ? 'lobby' : 'setup',   // setup | lobby | ready | playing | result | win
      settings: cleanSettings(null),
      players: [],                         // [{ id, name, team: 0 | 1 | null }]
      scores: [0, 0], round: 1, starter: 0, holding: 0, loser: 0, over: false,
      turn: [0, 0], describer: null,
      deck: [], idx: 0, phrase: null,
      roundMs: 0, roundStartedAt: 0
    };
  }

  // action: { type, from, now, ...data }. "from" and "now" are filled in by the
  // session, never trusted from the sender.
  function reduce(state, a) {
    var s = clone(state);
    var isHost = a.from === HOST;
    var me = findPlayer(s, a.from);

    switch (a.type) {
      case 'JOIN':
        if (!s.online) return state;
        if (me) { me.name = cleanName(a.name, me.name); return s; }
        if (s.players.length >= MAX_PLAYERS) return state;
        s.players.push({ id: a.from, name: cleanName(a.name, 'Player ' + (s.players.length + 1)), team: null });
        return s;

      case 'LEAVE':
        if (!me) return state;
        s.players = s.players.filter(function (p) { return p.id !== a.from; });
        if (s.phase === 'playing' && s.describer === a.from) s.describer = pickDescriber(s, s.holding);
        return s;

      case 'SET_NAME':
        if (!me) return state;
        me.name = cleanName(a.name, me.name);
        return s;

      case 'SET_TEAM':
        if (!me || s.phase !== 'lobby' || (a.team !== 0 && a.team !== 1)) return state;
        me.team = a.team;
        return s;

      case 'SETTINGS':
        if (!isHost || (s.phase !== 'setup' && s.phase !== 'lobby')) return state;
        s.settings = cleanSettings(a.settings);
        return s;

      case 'START_GAME':
        if (!isHost || !canStart(s)) return state;
        s.scores = [0, 0];
        s.starter = 0;
        s.round = 1;
        s.over = false;
        s.turn = [0, 0];
        s.deck = buildDeck(s.settings);
        s.idx = 0;
        s.phase = 'ready';
        return s;

      case 'START_ROUND': {
        if (!isHost || s.phase !== 'ready') return state;
        var r = LENGTHS[s.settings.length];
        s.roundMs = Math.round((r[0] + Math.random() * (r[1] - r[0])) * 1000);
        s.roundStartedAt = a.now;
        s.holding = s.starter;
        s.describer = pickDescriber(s, s.holding);
        nextPhrase(s);
        s.phase = 'playing';
        return s;
      }

      case 'PASS':
        if (s.phase !== 'playing' || (s.online && a.from !== s.describer)) return state;
        s.holding = 1 - s.holding;
        s.describer = pickDescriber(s, s.holding);
        nextPhrase(s);
        return s;

      case 'SKIP':
        if (s.phase !== 'playing' || (s.online && a.from !== s.describer)) return state;
        nextPhrase(s);
        return s;

      case 'BUZZ': {
        if (a.from !== TIMER || s.phase !== 'playing') return state;
        s.loser = s.holding;
        var winner = 1 - s.loser;
        s.scores[winner] += 1;
        s.over = s.scores[winner] >= s.settings.target;
        s.describer = null;
        s.phase = 'result';
        return s;
      }

      case 'NEXT_ROUND':
        if (!isHost || s.phase !== 'result') return state;
        if (s.over) { s.phase = 'win'; return s; }
        s.round += 1;
        s.starter = 1 - s.starter;
        s.phase = 'ready';
        return s;

      case 'END':
        if (!isHost) return state;
        s.describer = null;
        s.phase = s.online ? 'lobby' : 'setup';
        return s;
    }
    return state;
  }

  // What one player is allowed to see. Only the describer gets the phrase, and
  // the timer is sent as "ms left" so the devices' clocks never need to agree.
  function viewFor(s, id, now) {
    var me = findPlayer(s, id);
    var describer = findPlayer(s, s.describer);
    var canDescribe = s.phase === 'playing' && (!s.online || s.describer === id);
    return {
      online: s.online,
      phase: s.phase,
      settings: s.settings,
      players: s.players,
      scores: s.scores,
      round: s.round,
      starter: s.starter,
      holding: s.holding,
      loser: s.loser,
      over: s.over,
      me: id,
      isHost: id === HOST,
      myTeam: me ? me.team : null,
      canStart: canStart(s),
      canDescribe: canDescribe,
      describerName: describer ? describer.name : '',
      phrase: canDescribe ? s.phrase : null,
      roundMs: s.roundMs,
      msLeft: s.phase === 'playing' ? Math.max(0, s.roundMs - (now - s.roundStartedAt)) : 0
    };
  }

  PP.rules = {
    LENGTHS: LENGTHS, TARGETS: TARGETS, TEAMS: TEAMS, HOST: HOST, TIMER: TIMER,
    cleanSettings: cleanSettings, deckSize: deckSize,
    newState: newState, reduce: reduce, viewFor: viewFor
  };
})(window.PP = window.PP || {});
