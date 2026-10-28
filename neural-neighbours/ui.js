/* Neural Neighbours: drawing the screens. render(view) shows whatever the rules
   say is happening. Also owns this device's settings and draws the dial. */
(function (NN) {
  'use strict';

  var R = NN.rules;
  var TEAMS = R.TEAMS;
  var STORE_KEY = 'neural-neighbours-settings';
  var SVG = 'http://www.w3.org/2000/svg';

  function $(id) { return document.getElementById(id); }
  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  var settings = R.cleanSettings(null);
  var setupKind = 'local';
  var admin = false; // the host has switched on admin controls (anything with class admin-only)

  /* ---------- settings (optional per-device convenience) ---------- */
  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) settings = R.cleanSettings(JSON.parse(raw));
    } catch (e) { /* storage unavailable: defaults are fine */ }
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  /* ---------- screens ---------- */
  var SCREENS = ['s-mode', 's-setup', 's-join', 's-lobby', 's-game', 's-win'];
  var current = 's-mode';
  function show(id) {
    if (id === current) return;
    current = id;
    SCREENS.forEach(function (s) { $(s).hidden = (s !== id); });
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  /* ---------- setup screen ---------- */
  function wireRadios(name, onPick) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (i) {
      i.addEventListener('change', function () { if (i.checked) onPick(i.value); });
    });
  }

  function refreshSetup() {
    var solo = settings.mode === 'solo' && setupKind !== 'local';
    $('modeField').hidden = (setupKind === 'local');
    $('targetField').hidden = solo;
    $('lapsField').hidden = !solo;
    $('modeHint').textContent = settings.mode === 'solo'
      ? 'Everyone turns their own dial in secret. The psychic scores the average of everyone\'s points.'
      : 'Your team turns one dial together, then the other team calls left or right for a bonus point.';
  }

  function initSetup() {
    $('mode-' + settings.mode).checked = true;
    $('tgt-' + settings.target).checked = true;
    $('laps-' + settings.laps).checked = true;
    wireRadios('mode', function (v) {
      if (R.MODES.indexOf(v) > -1) { settings.mode = v; refreshSetup(); saveSettings(); }
    });
    wireRadios('target', function (v) {
      var n = parseInt(v, 10);
      if (R.TARGETS.indexOf(n) > -1) { settings.target = n; saveSettings(); }
    });
    wireRadios('laps', function (v) {
      var n = parseInt(v, 10);
      if (R.LAPS.indexOf(n) > -1) { settings.laps = n; saveSettings(); }
    });
    refreshSetup();
  }

  // kind: 'local', 'host-new' (before the room exists) or 'host-room'
  function setupFor(kind) {
    setupKind = kind;
    $('setupKicker').textContent = kind === 'local' ? 'One phone' : 'Online room';
    $('btnStart').textContent = kind === 'local' ? 'Start game' : kind === 'host-new' ? 'Open a room' : 'Back to room';
    $('btnSetupBack').hidden = (kind === 'host-room');
    setupStatus('');
    refreshSetup();
  }
  function setupStatus(text) { $('setupStatus').textContent = text; }
  function busy(id, text) {
    var b = $(id);
    if (text) { b.dataset.label = b.textContent; b.textContent = text; b.disabled = true; }
    else { if (b.dataset.label) b.textContent = b.dataset.label; b.disabled = false; }
  }

  /* ---------- the dial ---------- */
  // 0 is the left end, 100 the right end, drawn as a half circle around (100, 100).
  var CX = 100, CY = 100, RAD = 95;
  function pt(value, r) {
    var a = Math.PI * (1 - value / 100);
    return (CX + r * Math.cos(a)).toFixed(2) + ' ' + (CY - r * Math.sin(a)).toFixed(2);
  }
  function el(tag, attrs, text) {
    var e = document.createElementNS(SVG, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function wedge(from, to, cls) {
    return el('path', { 'class': cls, d: 'M ' + CX + ' ' + CY + ' L ' + pt(from, RAD) + ' A ' + RAD + ' ' + RAD + ' 0 0 1 ' + pt(to, RAD) + ' Z' });
  }

  // Where this device has turned the dial. It shows this rather than waiting for
  // the host. Teams send it live, so after letting go it is kept only until the
  // host's view catches up; in solo nobody sees it until it is locked in.
  var hold = { value: null, dragging: false, timer: null };
  var last = null; // the latest view

  function drawDial(v) {
    var svg = $('dial');
    svg.textContent = '';
    svg.appendChild(el('path', { 'class': 'face', d: 'M ' + (CX - RAD) + ' ' + CY + ' A ' + RAD + ' ' + RAD + ' 0 0 1 ' + (CX + RAD) + ' ' + CY + ' Z' }));

    if (v.target !== null) {
      var b = v.band;
      [[-4.5, -2.5, 1], [-2.5, -0.5, 2], [-0.5, 0.5, 4], [0.5, 2.5, 2], [2.5, 4.5, 1]].forEach(function (w) {
        var from = Math.max(0, v.target + w[0] * b), to = Math.min(100, v.target + w[1] * b);
        if (to <= from) return; // run off the end of the dial
        svg.appendChild(wedge(from, to, 'w' + w[2]));
        if (to - from < b / 2) return; // too thin a sliver to label
        var xy = pt((from + to) / 2, RAD - 10).split(' ');
        svg.appendChild(el('text', { 'class': 'wnum', x: xy[0], y: xy[1] }, String(w[2])));
      });
    }

    // Solo, after the reveal: everyone else's guesses as dots.
    if (v.solo && v.result) {
      v.guessers.forEach(function (g) {
        if (g.id === v.me || g.value === null) return;
        var xy = pt(g.value, 74).split(' ');
        svg.appendChild(el('circle', { 'class': 'mark t1', cx: xy[0], cy: xy[1], r: 4 }));
        var lxy = pt(g.value, 62).split(' ');
        svg.appendChild(el('text', { 'class': 'mark-label', x: lxy[0], y: lxy[1] }, g.name.slice(0, 8)));
      });
    }

    var value = dialValue(v);
    var live = !!v.canTurn;
    svg.classList.toggle('live', live);
    svg.setAttribute('tabindex', live ? '0' : '-1');
    // No needle while the psychic peeks at the target.
    var peeking = v.phase === 'clue' && v.target !== null;
    if (value !== null && !peeking) {
      svg.setAttribute('aria-valuenow', String(Math.round(value)));
      svg.appendChild(el('line', { 'class': 'needle', x1: CX, y1: CY, x2: pt(value, RAD - 8).split(' ')[0], y2: pt(value, RAD - 8).split(' ')[1] }));
      var k = pt(value, RAD - 8).split(' ');
      svg.appendChild(el('circle', { 'class': 'knob', cx: k[0], cy: k[1], r: live ? 7 : 5 }));
    }
    svg.appendChild(el('circle', { 'class': 'hub', cx: CX, cy: CY, r: 6 }));
  }

  function dialValue(v) {
    if (hold.value !== null && v.canTurn) return hold.value;
    return v.dial;
  }

  // The dial value under a pointer event.
  function dialValueAt(e) {
    var svg = $('dial');
    var p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    var q = p.matrixTransform(svg.getScreenCTM().inverse());
    var a = Math.atan2(CY - q.y, q.x - CX);
    if (a < 0) a = q.x < CX ? Math.PI : 0;   // below the dial: stick to the nearest end
    return Math.max(0, Math.min(100, 100 * (1 - a / Math.PI)));
  }

  function forget() { clearTimeout(hold.timer); hold.value = null; hold.dragging = false; }
  function turnDial(value, dragging) {
    clearTimeout(hold.timer);
    hold.value = value;
    hold.dragging = dragging;
    if (!dragging && last && !last.solo) hold.timer = setTimeout(function () { forget(); if (last) drawDial(last); }, 1000);
    if (last) drawDial(last);
  }
  function shownDial() { return last ? dialValue(last) : null; }

  /* ---------- drawing ---------- */
  var roomCode = '';
  function setRoom(code) { roomCode = code; }

  function teamName(t) { return TEAMS[t].name; }
  function hint(id, text) {
    $(id).hidden = !text;
    if (text) $(id).textContent = text;
  }
  function tint(id, t) {
    var s = $(id);
    s.classList.remove('t0', 't1');
    s.classList.add(TEAMS[t].cls);
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function listNames(names) {
    return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }
  function mine(v) {
    for (var i = 0; i < v.standings.length; i++) if (v.standings[i].id === v.me) return v.standings[i];
    return null;
  }
  function box(cls, title, wide) {
    var b = document.createElement('div');
    b.className = 'score ' + cls + (wide ? ' wide' : '');
    var name = document.createElement('span');
    name.className = 'name';
    name.textContent = title;
    b.appendChild(name);
    return b;
  }
  function nameSpan(p, v) {
    var s = document.createElement('span');
    s.textContent = p.name;
    if (p.id === v.me) s.className = 'you';
    return s;
  }

  // Ready screen: who is the psychic next. The host can move players up.
  function renderOrder(v) {
    var board = $('order');
    board.textContent = '';
    board.hidden = !v.online || v.phase !== 'ready';
    if (board.hidden) return;
    (v.solo ? [0] : [0, 1]).forEach(function (g) {
      var col = box(TEAMS[g].cls, v.solo ? 'Psychic order' : teamName(g) + (g === v.active ? ' · up now' : ''), v.solo);
      var list = document.createElement('ol');
      v.order[g].forEach(function (p, i) {
        var li = document.createElement('li');
        li.appendChild(nameSpan(p, v));
        if (v.isHost && i > 0) {
          var up = document.createElement('button');
          up.type = 'button';
          up.className = 'up admin-only';
          up.textContent = '↑';
          up.dataset.group = String(g);
          up.dataset.index = String(i);
          up.setAttribute('aria-label', 'Move ' + p.name + ' up');
          li.appendChild(up);
        }
        list.appendChild(li);
      });
      col.appendChild(list);
      if (v.went[g].length) {
        var went = document.createElement('span');
        went.className = 'hint';
        went.style.color = 'inherit';
        went.textContent = 'Already went: ' + v.went[g].map(function (p) { return p.name; }).join(', ');
        col.appendChild(went);
      }
      board.appendChild(col);
    });
  }

  function renderResults(v) {
    var board = $('results');
    board.textContent = '';
    board.hidden = v.phase !== 'reveal';
    if (board.hidden) return;
    if (!v.solo) {
      TEAMS.forEach(function (team, i) {
        var b = box(team.cls, team.name);
        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(v.scores[i]);
        b.appendChild(num);
        board.appendChild(b);
      });
      return;
    }
    var gains = {};
    v.guessers.forEach(function (g) { gains[g.id] = g.points; });
    var b = box('t0', 'Points · this round and total', true);
    var list = document.createElement('ul');
    v.standings.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'row';
      var label = nameSpan(p, v);
      var gain = document.createElement('span');
      gain.className = 'gain';
      var got = has(gains, p.id) ? '+' + gains[p.id] : p.id === v.psychic ? '+' + v.result.psychic + ' psychic' : '';
      gain.textContent = (got ? got + ' · ' : '') + p.points;
      li.appendChild(label);
      li.appendChild(gain);
      list.appendChild(li);
    });
    b.appendChild(list);
    board.appendChild(b);
  }

  function statusFor(v) {
    var team = teamName(v.active), other = teamName(1 - v.active);
    switch (v.phase) {
      case 'ready':
        if (!v.online) return team + ' team: pick a psychic. Everyone else, look away when they peek.';
        var next = v.order[v.group][0];
        return (next ? (next.id === v.me ? 'You are' : next.name + ' is') + ' the psychic' : 'Nobody is left to be the psychic') +
          (v.solo ? '.' : ' for ' + team + '.');
      case 'clue':
        if (!v.online) return v.peek
          ? 'Psychic: think of a clue for the target, then hide it and say your clue out loud.'
          : 'Psychic: peek at the target. Everyone else, look away!';
        if (v.isPsychic) return 'Think of a clue for where the target is, then say it out loud.';
        return v.psychicName + ' is thinking of a clue…';
      case 'guess':
        if (v.solo) {
          var waiting = v.guessers.filter(function (g) { return !g.locked; }).length;
          if (v.canTurn) return 'Turn your dial to where the clue belongs, then lock it in.';
          if (v.locked) return 'Locked in. Waiting for ' + plural(waiting, 'more player') + '.';
          return 'Everyone is guessing. ' + (v.guessers.length - waiting) + ' of ' + v.guessers.length + ' locked in.';
        }
        if (v.canTurn) return team + ': turn the dial to where the clue belongs, then lock it in.';
        if (v.isPsychic) return 'No hints! ' + team + ' is turning the dial.';
        return team + ' is turning the dial…';
      case 'steal':
        if (v.canSteal) return other + ': is the target left or right of the dial?';
        return other + ' is calling left or right…';
      case 'reveal':
        if (v.solo) {
          if (v.isPsychic) return 'Your clue earned you ' + plural(v.result.psychic, 'point') + ', the average of everyone\'s.';
          for (var i = 0; i < v.guessers.length; i++) {
            if (v.guessers[i].id === v.me) return 'You scored ' + plural(v.guessers[i].points, 'point') + '.';
          }
          return v.psychicName + '\'s clue earned ' + plural(v.result.psychic, 'point') + '.';
        }
        var pts = v.result.points;
        return (pts ? team + ' scores ' + pts + '. ' : team + ' misses. ') +
          other + ' called ' + v.steal + (v.result.stealOk ? ' and gets 1.' : ' and gets nothing.');
    }
    return '';
  }

  /* ---------- admin controls ---------- */
  // Hidden by default so the screen stays simple; the host can switch them on.
  function toggleAdmin() {
    admin = !admin;
    document.body.classList.toggle('admin', admin);
  }
  // The switch only shows when the screen has admin controls on it: for now,
  // the turn order before a round. Widen this when adding more.
  function hasAdmin(v) { return v.isHost && v.online && v.phase === 'ready'; }
  function paintAdmin(available) {
    $('btnAdmin').hidden = !available;
    $('btnAdmin').setAttribute('aria-checked', String(admin));
  }

  function renderGame(v) {
    var playing = v.phase !== 'ready';
    $('ends').hidden = !playing;
    $('dial').toggleAttribute('hidden', !playing); // an svg has no .hidden property
    if (v.card) {
      $('endLeft').textContent = v.card.left;
      $('endRight').textContent = v.card.right;
    }
    if (playing) drawDial(v);
    $('status').textContent = statusFor(v);

    if (v.solo) {
      var me = mine(v);
      $('who').textContent = 'Round ' + v.round + ' · lap ' + Math.min(v.lap, v.settings.laps) + ' of ' + v.settings.laps;
      $('miniScore').textContent = me ? 'You: ' + plural(me.points, 'point') : '';
    } else {
      $('who').textContent = 'Round ' + v.round + ' · ' + teamName(v.active) + '\'s turn';
      $('miniScore').textContent = teamName(0) + ' ' + v.scores[0] + ' : ' + v.scores[1] + ' ' + teamName(1);
    }
    $('who').className = v.solo ? '' : 'team-' + v.active;

    renderOrder(v);
    renderResults(v);

    $('btnGo').hidden = !(v.phase === 'ready' && v.isHost);
    $('btnShuffle').hidden = !(v.phase === 'ready' && v.isHost && v.online);
    $('btnPeek').hidden = !(v.phase === 'clue' && !v.online);
    $('btnPeek').textContent = v.peek ? 'Hide the target' : 'Psychic: Peek';
    $('btnClue').hidden = !v.canClue;
    $('btnLock').hidden = !v.canTurn;
    $('stealRow').hidden = !v.canSteal;
    $('btnReveal').hidden = !(v.phase === 'guess' && v.solo && v.isHost);
    $('btnNext').hidden = !(v.phase === 'reveal' && v.isHost);
    $('btnNext').textContent = v.over ? 'See the winner' : 'Next round';
    $('btnEnd').hidden = !(v.phase === 'reveal' && v.isHost);

    var wait = '';
    if (!v.isHost && v.phase === 'ready') wait = 'Waiting for the host to start the round.';
    if (!v.isHost && v.phase === 'reveal') wait = v.over ? 'Waiting for the host to show the winner.' : 'Waiting for the host to start the next round.';
    if (v.isHost && v.phase === 'ready' && v.online && admin) wait = 'Set who is the psychic in what order, then start.';
    hint('gameHint', wait);
  }

  function renderWin(v) {
    $('btnAgain').hidden = !v.isHost;
    $('btnSettings').hidden = !v.isHost;
    hint('winHint', v.isHost ? '' : 'Waiting for the host to start a new game.');
    if (v.solo) {
      tint('s-win', 0);
      var best = v.standings.length ? v.standings[0].points : 0;
      var winners = v.standings.filter(function (p) { return p.points === best; }).map(function (p) { return p.name; });
      $('winTitle').textContent = listNames(winners) + (winners.length === 1 ? ' wins' : ' win');
      $('winScore').textContent = 'Points: ' + v.standings.map(function (p) { return p.name + ' ' + p.points; }).join(', ') + '.';
      return;
    }
    var w = v.scores[0] > v.scores[1] ? 0 : 1;
    tint('s-win', w);
    $('winTitle').textContent = teamName(w) + ' team wins';
    $('winScore').textContent = 'First to ' + v.settings.target + '. Final score ' + teamName(0) + ' ' + v.scores[0] + ', ' + teamName(1) + ' ' + v.scores[1] + '.';
  }

  function renderLobby(v) {
    $('lobbyCode').textContent = roomCode;
    $('team-0').checked = v.myTeam === 0;
    $('team-1').checked = v.myTeam === 1;
    $('teamField').hidden = v.solo;

    var board = $('lobbyTeams');
    board.textContent = '';
    var groups = v.solo ? [{ title: 'Players · no teams', cls: 't0', members: v.players }]
      : TEAMS.map(function (team, t) {
        return { title: team.name, cls: team.cls, members: v.players.filter(function (p) { return p.team === t; }) };
      });
    groups.forEach(function (g) {
      var col = box(g.cls, g.title, v.solo);
      var list = document.createElement('ul');
      g.members.forEach(function (p) {
        var li = document.createElement('li');
        li.textContent = p.name;
        if (p.id === v.me) li.className = 'you';
        list.appendChild(li);
      });
      if (!g.members.length) {
        var none = document.createElement('li');
        none.className = 'empty';
        none.textContent = 'Nobody yet';
        list.appendChild(none);
      }
      col.appendChild(list);
      board.appendChild(col);
    });
    var picking = v.solo ? [] : v.players.filter(function (p) { return p.team === null; }).map(function (p) { return p.name; });
    if (picking.length) {
      var p = document.createElement('p');
      p.className = 'hint wide';
      p.textContent = 'Still picking a team: ' + picking.join(', ');
      board.appendChild(p);
    }

    $('lobbySettings').textContent = v.solo
      ? 'No teams. Everyone is the psychic ' + (v.settings.laps === 1 ? 'once' : v.settings.laps === 2 ? 'twice' : v.settings.laps + ' times') + '.'
      : 'Two teams, first to ' + v.settings.target + ' points.';

    $('btnLobbyStart').hidden = !v.isHost;
    $('btnLobbyStart').disabled = !v.canStart;
    $('btnLobbySettings').hidden = !v.isHost;
    var status;
    if (v.solo) {
      if (!v.isHost) status = 'Waiting for the host to start.';
      else if (!v.canStart) status = 'Needs at least two players.';
      else status = 'Start when everyone is in.';
    }
    else if (v.myTeam === null) status = 'Pick a team.';
    else if (!v.isHost) status = 'Waiting for the host to start.';
    else if (!v.canStart) status = 'Each team needs at least two players.';
    else status = 'Start when everyone is in.';
    $('lobbyStatus').textContent = status;
  }

  var SCREEN_FOR = { setup: 's-setup', lobby: 's-lobby', ready: 's-game', clue: 's-game', guess: 's-game', steal: 's-game', reveal: 's-game', win: 's-win' };

  // opts.stay: redraw, but keep the current screen (the host is editing settings)
  function render(v, opts) {
    var was = last;
    last = v;
    // Locked in, a new round, or the host has caught up: forget this device's own value.
    if (!v.canTurn || (was && was.round !== v.round)) forget();
    else if (!v.solo && !hold.dragging && v.dial === hold.value) forget();

    if (v.phase === 'lobby') renderLobby(v);
    else if (v.phase === 'win') renderWin(v);
    else if (SCREEN_FOR[v.phase] === 's-game') renderGame(v);

    paintAdmin(!(opts && opts.stay) && hasAdmin(v));
    if (!(opts && opts.stay)) show(SCREEN_FOR[v.phase]);
  }

  // Leaving a game: forget the last view.
  function reset() {
    last = null;
    roomCode = '';
    paintAdmin(false);
    forget();
  }

  loadSettings();
  initSetup();

  NN.ui = {
    $: $, show: show, render: render, reset: reset, setRoom: setRoom,
    setupFor: setupFor, setupStatus: setupStatus, busy: busy, toggleAdmin: toggleAdmin,
    dialValueAt: dialValueAt, turnDial: turnDial, shownDial: shownDial,
    settings: function () { return settings; }
  };
})(window.NN = window.NN || {});
