/* Neural Neighbours: the game rules. No DOM, no network, no timers.

   A card has two ends, like Cold ... Hot. A target is hidden somewhere on the
   dial between them. The psychic sees it and says a clue out loud, everyone
   else turns the dial to where they think the clue belongs.

   Teams: the psychic's team shares one dial, then the other team guesses
     whether the target is left or right of it for a bonus point.
   Solo (online only): everyone turns their own dial in secret. The psychic
     scores the average of the guessers' points.

   reduce(state, action) returns the next state, or the same state if the action
   is not allowed. In local play it runs on the one phone; online it only runs
   on the host's device, and everyone else gets a view of the result. */
(function (NN) {
  'use strict';

  var TEAMS = [{ name: 'Teal', cls: 't0' }, { name: 'Magenta', cls: 't1' }];
  var MODES = ['teams', 'solo'];
  var TARGETS = [5, 10, 15];  // teams: points to win
  var LAPS = [1, 2, 3];       // solo: times each player is the psychic
  var BAND = 5;               // width of the bullseye on the 0 to 100 dial; the 2 and 1 bands are twice as wide
  var HOST = 'host';          // the host's player id, also the single device in local play
  var MAX_PLAYERS = 16;

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function cleanSettings(s) {
    var out = { mode: 'teams', target: 10, laps: 1 };
    if (!s || typeof s !== 'object') return out;
    if (MODES.indexOf(s.mode) > -1) out.mode = s.mode;
    if (TARGETS.indexOf(s.target) > -1) out.target = s.target;
    if (LAPS.indexOf(s.laps) > -1) out.laps = s.laps;
    return out;
  }

  function cleanName(name, fallback) {
    var n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    return n || fallback;
  }

  function cleanDial(v) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    return Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;
  }

  // 4 for a bullseye, then 2 and 1 on either side.
  function pointsFor(guess, target) {
    var d = Math.abs(guess - target);
    if (d <= BAND / 2) return 4;
    if (d <= BAND * 2.5) return 2;
    if (d <= BAND * 4.5) return 1;
    return 0;
  }

  /* ---------- cards ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function buildDeck() { return shuffle(NN.CARDS.map(function (c, i) { return i; })); }
  function nextCard(s) {
    if (s.idx >= s.deck.length) { s.deck = buildDeck(); s.idx = 0; }
    var c = NN.CARDS[s.deck[s.idx++]];
    s.card = { left: c[0], right: c[1] };
  }

  /* ---------- players ---------- */
  function findPlayer(s, id) {
    for (var i = 0; i < s.players.length; i++) if (s.players[i].id === id) return s.players[i];
    return null;
  }
  function teamOf(s, t) { return s.players.filter(function (p) { return p.team === t; }); }
  function ids(list) { return list.map(function (p) { return p.id; }); }
  function isSolo(s) { return s.online && s.settings.mode === 'solo'; }
  function group(s) { return isSolo(s) ? 0 : s.active; }   // which psychic order this round uses

  // Psychic order, per team (one shared order in solo). queue: still to go this
  // lap, next first. done: already went this lap. Everyone goes once per lap.
  function takePsychic(s, g) {
    if (!s.queue[g].length) { s.queue[g] = s.done[g]; s.done[g] = []; }
    if (!s.queue[g].length) return null;
    var id = s.queue[g].shift();
    s.done[g].push(id);
    return id;
  }
  function dropFromOrder(s, id) {
    [s.queue, s.done].forEach(function (lists) {
      lists.forEach(function (list, g) { lists[g] = list.filter(function (x) { return x !== id; }); });
    });
  }

  // A new order is only allowed if it has exactly the same players.
  function sameMembers(order, list) {
    if (!Array.isArray(list) || list.length !== order.length) return false;
    return order.every(function (id) { return list.indexOf(id) > -1; });
  }

  // Teams: who may turn the shared dial or lock it in, and who may call left or right.
  // The psychic only may if everyone else on their team has left.
  function canTurn(s, id) {
    if (!s.online) return true;
    var p = findPlayer(s, id);
    return !!p && p.team === s.active && (id !== s.psychic || teamOf(s, s.active).length === 1);
  }
  function canSteal(s, id) {
    if (!s.online) return true;
    var p = findPlayer(s, id);
    return !!p && p.team === 1 - s.active;
  }

  function canStart(s) {
    if (!s.online) return true;
    if (isSolo(s)) return s.players.length >= 2;
    return teamOf(s, 0).length >= 2 && teamOf(s, 1).length >= 2;
  }

  /* ---------- state ---------- */
  function newState(online) {
    return {
      online: online,
      phase: online ? 'lobby' : 'setup',   // setup | lobby | ready | clue | guess | steal | reveal | win
      settings: cleanSettings(null),
      players: [],                         // [{ id, name, team: 0 | 1 | null }]
      scores: [0, 0],                      // teams
      points: {},                          // solo: player id -> points, for everyone in this game
      round: 1, active: 0,                 // active: the team whose turn it is
      queue: [[], []], done: [[], []], laps: 0,
      psychic: null,
      deck: [], idx: 0, card: null, target: 50,
      dial: 50,                            // teams: the shared dial
      guesses: {},                         // solo: guesser id -> { value, locked }
      steal: null,                         // teams: 'left' | 'right'
      peek: false,                         // one phone: the psychic is looking at the target
      result: null, over: false
    };
  }

  function reveal(s) {
    if (isSolo(s)) {
      var got = {}, sum = 0, n = 0;
      Object.keys(s.guesses).forEach(function (id) {
        var pts = pointsFor(s.guesses[id].value, s.target);
        got[id] = pts;
        sum += pts;
        n += 1;
        if (has(s.points, id)) s.points[id] += pts;
      });
      var psychicPts = n ? Math.round(sum / n) : 0;
      if (has(s.points, s.psychic)) s.points[s.psychic] += psychicPts;
      s.result = { guesses: got, psychic: psychicPts };
      if (!s.queue[0].length) s.laps += 1;
      s.over = s.laps >= s.settings.laps;
    } else {
      var pts = pointsFor(s.dial, s.target);
      var stealOk = s.steal === 'left' ? s.target < s.dial : s.steal === 'right' ? s.target > s.dial : false;
      s.scores[s.active] += pts;
      if (stealOk) s.scores[1 - s.active] += 1;
      s.result = { points: pts, stealOk: stealOk };
      var best = Math.max(s.scores[0], s.scores[1]);
      s.over = best >= s.settings.target && s.scores[0] !== s.scores[1];
    }
    s.phase = 'reveal';
  }

  function allLocked(s) {
    var keys = Object.keys(s.guesses);
    return keys.length > 0 && keys.every(function (id) { return s.guesses[id].locked; });
  }

  // action: { type, from, now, ...data }. "from" and "now" are filled in by the
  // session, never trusted from the sender.
  function reduce(state, a) {
    var s = clone(state);
    var isHost = a.from === HOST;
    var me = findPlayer(s, a.from);
    var v;

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
        dropFromOrder(s, a.from);
        delete s.points[a.from];
        delete s.guesses[a.from];
        var midRound = s.phase === 'clue' || s.phase === 'guess' || s.phase === 'steal';
        if (midRound && s.psychic === a.from) {
          // No psychic, no round: back to the ready screen for someone else.
          s.psychic = null;
          s.card = null;
          s.phase = 'ready';
        } else if (s.phase === 'guess' && isSolo(s) && allLocked(s)) {
          reveal(s);
        }
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
        s.points = {};
        if (isSolo(s)) {
          s.players.forEach(function (p) { s.points[p.id] = 0; });
          s.queue = [ids(s.players), []];
        } else {
          s.queue = [ids(teamOf(s, 0)), ids(teamOf(s, 1))];
        }
        s.done = [[], []];
        s.laps = 0;
        s.round = 1;
        s.active = 0;
        s.psychic = null;
        s.card = null;
        s.result = null;
        s.over = false;
        s.deck = buildDeck();
        s.idx = 0;
        s.phase = 'ready';
        return s;

      case 'SET_ORDER': {
        if (!isHost || s.phase !== 'ready') return state;
        var g = a.group;
        if (!(g === 0 || (g === 1 && !isSolo(s))) || !sameMembers(s.queue[g], a.order)) return state;
        s.queue[g] = a.order.slice();
        return s;
      }

      case 'SHUFFLE_ORDER':
        if (!isHost || s.phase !== 'ready') return state;
        s.queue.forEach(shuffle);
        return s;

      case 'START_ROUND':
        if (!isHost || s.phase !== 'ready') return state;
        s.psychic = null;
        if (s.online) {
          s.psychic = takePsychic(s, group(s));
          if (!s.psychic) return state;
        }
        s.guesses = {};
        if (isSolo(s)) {
          Object.keys(s.points).forEach(function (id) {
            if (id !== s.psychic) s.guesses[id] = { value: 50, locked: false };
          });
        }
        nextCard(s);
        // Keep the bullseye on the dial; the outer bands may run off the ends.
        s.target = Math.round((BAND / 2 + Math.random() * (100 - BAND)) * 10) / 10;
        s.dial = 50;
        s.steal = null;
        s.peek = false;
        s.result = null;
        s.phase = 'clue';
        return s;

      case 'PEEK':
        if (s.online || s.phase !== 'clue') return state;
        s.peek = !!a.on;
        return s;

      case 'CLUE_GIVEN':
        if (s.phase !== 'clue' || (s.online && a.from !== s.psychic)) return state;
        s.peek = false;
        s.phase = 'guess';
        return s;

      // Teams: the team's dial, live, so everyone watches it turn.
      case 'SET_DIAL':
        v = cleanDial(a.value);
        if (s.phase !== 'guess' || isSolo(s) || v === null || !canTurn(s, a.from) || s.dial === v) return state;
        s.dial = v;
        return s;

      // In solo the dial only turns on the guesser's own device, and arrives here once, when locked in.
      case 'LOCK':
        v = cleanDial(a.value);
        if (s.phase !== 'guess' || v === null) return state;
        if (isSolo(s)) {
          var g2 = s.guesses[a.from];
          if (!g2 || g2.locked) return state;
          g2.value = v;
          g2.locked = true;
          if (allLocked(s)) reveal(s);
        } else {
          if (!canTurn(s, a.from)) return state;
          s.dial = v;
          s.phase = 'steal';
        }
        return s;

      case 'REVEAL':  // solo: the host stops waiting for slow guessers
        if (!isHost || !isSolo(s) || s.phase !== 'guess') return state;
        reveal(s);
        return s;

      case 'STEAL':
        if (s.phase !== 'steal' || (a.side !== 'left' && a.side !== 'right') || !canSteal(s, a.from)) return state;
        s.steal = a.side;
        reveal(s);
        return s;

      case 'NEXT_ROUND':
        if (!isHost || s.phase !== 'reveal') return state;
        if (s.over) { s.phase = 'win'; return s; }
        s.round += 1;
        if (!isSolo(s)) s.active = 1 - s.active;
        // Start the next lap now, so the host can reorder it on the ready screen.
        s.queue.forEach(function (q, g) { if (!q.length) { s.queue[g] = s.done[g]; s.done[g] = []; } });
        s.psychic = null;
        s.card = null;
        s.phase = 'ready';
        return s;

      case 'END':
        if (!isHost) return state;
        s.psychic = null;
        s.phase = s.online ? 'lobby' : 'setup';
        return s;
    }
    return state;
  }

  // What one player is allowed to see. The target stays hidden from everyone
  // but the psychic until the reveal, and in solo nobody sees anyone else's dial.
  function viewFor(s, id) {
    var me = findPlayer(s, id);
    var solo = isSolo(s);
    var psychic = findPlayer(s, s.psychic);
    var isPsychic = s.online && s.psychic === id;
    var hidden = s.phase === 'clue' || s.phase === 'guess' || s.phase === 'steal';
    var revealed = s.phase === 'reveal' || s.phase === 'win';
    var showTarget = revealed || (hidden && (s.online ? isPsychic : s.peek));
    var mine = solo ? s.guesses[id] : null;
    function named(list) {
      return list.map(function (pid) { var p = findPlayer(s, pid); return { id: pid, name: p ? p.name : '' }; });
    }

    return {
      online: s.online,
      solo: solo,
      phase: s.phase,
      settings: s.settings,
      players: s.players,
      me: id,
      isHost: id === HOST,
      myTeam: me ? me.team : null,
      canStart: canStart(s),
      round: s.round,
      active: s.active,
      scores: s.scores,
      psychic: s.psychic,
      psychicName: psychic ? psychic.name : '',
      isPsychic: isPsychic,
      card: s.card,
      target: showTarget ? s.target : null,
      peek: s.peek,
      band: BAND,
      // The dial this device shows: the team's, or in solo your own. While guessing,
      // the device turning it shows its own value instead (see ui.js).
      dial: solo ? (mine ? mine.value : null) : s.dial,
      canTurn: s.phase === 'guess' && (solo ? !!mine && !mine.locked : canTurn(s, id)),
      canSteal: s.phase === 'steal' && canSteal(s, id),
      canClue: s.phase === 'clue' && (!s.online || isPsychic),
      locked: !!(mine && mine.locked),
      // Solo: who is still guessing. Values only once everything is revealed.
      guessers: Object.keys(s.guesses).map(function (gid) {
        var p = findPlayer(s, gid);
        var g = s.guesses[gid];
        return {
          id: gid, name: p ? p.name : '', locked: g.locked,
          value: revealed ? g.value : null,
          points: revealed && s.result && s.result.guesses ? s.result.guesses[gid] : null
        };
      }),
      steal: s.steal,
      result: revealed ? s.result : null,
      over: s.over,
      // Psychic order for the ready screen: who is still to go this lap, then who went.
      order: s.queue.map(named),
      went: s.done.map(named),
      group: group(s),
      lap: s.laps + 1,
      standings: s.players.filter(function (p) { return has(s.points, p.id); })
        .map(function (p) { return { id: p.id, name: p.name, points: s.points[p.id] }; })
        .sort(function (x, y) { return y.points - x.points; })
    };
  }

  NN.rules = {
    TEAMS: TEAMS, MODES: MODES, TARGETS: TARGETS, LAPS: LAPS, HOST: HOST,
    cleanSettings: cleanSettings, pointsFor: pointsFor,
    newState: newState, reduce: reduce, viewFor: viewFor
  };
})(window.NN = window.NN || {});
