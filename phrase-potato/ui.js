/* Phrase Potato: drawing the screens. render(view) shows whatever the rules say
   is happening, and plays sounds when something changes between two views.
   Also owns this device's settings, sound, vibration and screen wake. */
(function (PP) {
  'use strict';

  var R = PP.rules;
  var TEAMS = R.TEAMS;
  var STORE_KEY = 'phrase-potato-settings';

  function $(id) { return document.getElementById(id); }
  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  var settings = R.cleanSettings(null);

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
  var SCREENS = ['s-mode', 's-setup', 's-join', 's-lobby', 's-play', 's-result', 's-win'];
  var current = 's-mode';
  function show(id) {
    if (id === current) return;
    current = id;
    SCREENS.forEach(function (s) { $(s).hidden = (s !== id); });
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  /* ---------- mode and setup screens ---------- */
  function buildCats() {
    var box = $('cats');
    PP.DECK_KEYS.forEach(function (k) {
      var label = document.createElement('label');
      label.className = 'chip';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'vh';
      input.id = 'cat-' + k;
      input.value = k;
      input.checked = settings.cats.indexOf(k) > -1;
      var span = document.createElement('span');
      span.textContent = PP.DECKS[k].label;
      label.appendChild(input);
      label.appendChild(span);
      box.appendChild(label);
      input.addEventListener('change', onCatsChange);
    });
  }

  // Unlike the rest of the settings, an empty pick is allowed while editing,
  // it just disables the start button.
  function onCatsChange() {
    var picked = [];
    $('cats').querySelectorAll('input').forEach(function (i) { if (i.checked) picked.push(i.value); });
    settings.cats = picked;
    refreshSetup();
    if (picked.length) saveSettings();
  }

  function refreshSetup() {
    var n = settings.cats.length ? R.deckSize(settings) : 0;
    $('deckCount').textContent = n ? n + ' phrases in the deck' : 'Pick at least one phrase type to start.';
    $('btnStart').disabled = (n === 0);
    var r = R.LENGTHS[settings.length];
    $('lengthHint').textContent = r[0] + ' to ' + r[1] + ' seconds, picked at random each round.';
  }

  function wireRadios(name, onPick) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (i) {
      i.addEventListener('change', function () { if (i.checked) onPick(i.value); });
    });
  }

  function setSound(on) {
    settings.sound = on;
    $('sound').checked = on;
    $('lobbySound').checked = on;
    saveSettings();
  }

  function initSetup() {
    buildCats();
    $('len-' + settings.length).checked = true;
    $('tgt-' + settings.target).checked = true;
    $('sound').checked = settings.sound;
    $('lobbySound').checked = settings.sound;
    wireRadios('length', function (v) {
      if (has(R.LENGTHS, v)) { settings.length = v; refreshSetup(); saveSettings(); }
    });
    wireRadios('target', function (v) {
      var n = parseInt(v, 10);
      if (R.TARGETS.indexOf(n) > -1) { settings.target = n; saveSettings(); }
    });
    $('sound').addEventListener('change', function () { setSound($('sound').checked); });
    $('lobbySound').addEventListener('change', function () { setSound($('lobbySound').checked); });
    refreshSetup();
  }

  // kind: 'local', 'host-new' (before the room exists) or 'host-room'
  function setupFor(kind) {
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

  /* ---------- sound, vibration, screen wake ---------- */
  var ctx = null;
  function audio() {
    if (!settings.sound) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, vol) {
    var c = audio();
    if (!c) return;
    try {
      var o = c.createOscillator();
      var gn = c.createGain();
      var t = c.currentTime;
      o.type = type;
      o.frequency.value = freq;
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn);
      gn.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
  var wake = null;
  function lockScreen() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (l) { wake = l; }).catch(function () { /* refused: fine */ });
      }
    } catch (e) { /* ignore */ }
  }
  function unlockScreen() {
    try {
      if (wake) { wake.release().catch(function () { /* ignore */ }); wake = null; }
    } catch (e) { /* ignore */ }
  }
  // Browsers only allow sound after a tap. Online, the round can start from
  // someone else's tap, so wake the audio on any tap on this device.
  document.addEventListener('pointerdown', function () { audio(); });

  /* ---------- beeps ---------- */
  // Each device runs its own beeps from the time left in the latest view.
  // They are only for feel: the host's timer decides when the buzzer goes.
  var clock = { endsAt: 0, total: 0, timer: null };

  // Time between beeps. Starts slow, ends frantic.
  function gap(p) { return 900 - 770 * Math.pow(p, 1.5); }

  function pulse() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      $('dot').animate(
        [{ transform: 'scale(1.9)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.55 }],
        { duration: 170, easing: 'ease-out' }
      );
    } catch (e) { /* ignore */ }
  }
  function tick() {
    clock.timer = null;
    var left = clock.endsAt - performance.now();
    if (left <= 0) return;
    var p = Math.max(0, 1 - left / clock.total);
    tone(600 + p * 600, 0.07, 'square', 0.14);
    pulse();
    clock.timer = setTimeout(tick, Math.min(gap(p), left));
  }
  function stopBeeps() {
    clearTimeout(clock.timer);
    clock.timer = null;
  }

  /* ---------- drawing ---------- */
  var prev = null;
  var roomCode = '';
  function setRoom(code) { roomCode = code; }

  function teamName(t) { return TEAMS[t].name; }

  function sizeFor(text) {
    var longest = 0;
    text.split(/\s+/).forEach(function (w) { if (w.length > longest) longest = w.length; });
    if (text.length <= 14 && longest <= 9) return 'l';
    if (text.length <= 26 && longest <= 11) return 'm';
    return 's';
  }
  function setPhrase(text, size) {
    var el = $('phrase');
    el.textContent = text;
    el.setAttribute('data-size', size || sizeFor(text));
  }
  function tint(id, t) {
    var s = $(id);
    s.classList.remove('t0', 't1');
    s.classList.add(TEAMS[t].cls);
  }
  function hint(id, text) {
    $(id).hidden = !text;
    if (text) $(id).textContent = text;
  }

  function paintMiniScore(v) {
    $('miniScore').textContent = teamName(0) + ' ' + v.scores[0] + ' : ' + v.scores[1] + ' ' + teamName(1);
  }

  function renderReady(v) {
    tint('s-play', v.starter);
    paintMiniScore(v);
    $('who').textContent = teamName(v.starter) + ' team starts';
    $('cat').textContent = 'Round ' + v.round;
    setPhrase('Ready?', 'l');
    $('btnGo').hidden = !v.isHost;
    $('btnPass').hidden = true;
    $('btnSkip').hidden = true;
    hint('playHint', v.isHost ? '' : 'Waiting for the host to start the round.');
  }

  function renderPlaying(v) {
    tint('s-play', v.holding);
    paintMiniScore(v);
    $('btnGo').hidden = true;
    $('btnPass').hidden = !v.canDescribe;
    $('btnSkip').hidden = !v.canDescribe;
    hint('playHint', '');
    if (!v.online) {
      $('btnPass').textContent = 'Guessed it. Pass the phone';
      $('who').textContent = teamName(v.holding) + ' team has the phone';
      $('cat').textContent = v.phrase.cat;
      setPhrase(v.phrase.text);
      return;
    }
    $('who').textContent = teamName(v.holding) + ' has the potato';
    $('btnPass').textContent = 'Got it. Pass the potato';
    if (v.canDescribe) {
      $('cat').textContent = 'You describe · ' + v.phrase.cat;
      setPhrase(v.phrase.text);
    } else {
      $('cat').textContent = v.describerName ? v.describerName + ' is describing' : teamName(v.holding) + ' team';
      setPhrase(v.myTeam === v.holding ? 'Guess!' : v.myTeam === null ? 'Watching' : 'Get ready', 'l');
    }
  }

  function renderBoard(el, v) {
    el.textContent = '';
    TEAMS.forEach(function (team, i) {
      var box = document.createElement('div');
      box.className = 'score ' + team.cls;
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = team.name;
      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(v.scores[i]);
      var pips = document.createElement('span');
      pips.className = 'pips';
      pips.setAttribute('aria-hidden', 'true');
      for (var k = 0; k < v.settings.target; k++) {
        var pip = document.createElement('span');
        pip.className = 'pip' + (k < v.scores[i] ? ' on' : '');
        pips.appendChild(pip);
      }
      box.appendChild(name);
      box.appendChild(num);
      box.appendChild(pips);
      el.appendChild(box);
    });
  }

  function renderResult(v) {
    var winner = 1 - v.loser;
    var thing = v.online ? 'potato' : 'phone';
    $('resTitle').textContent = 'Time is up';
    $('resDetail').textContent = teamName(v.loser) + ' team was holding the ' + thing + '. ' + teamName(winner) + ' team scores a point.';
    renderBoard($('board'), v);
    $('btnNext').textContent = v.over ? 'See the winner' : 'Next round';
    $('btnNext').hidden = !v.isHost;
    $('btnEnd').hidden = !v.isHost;
    hint('resHint', v.isHost ? '' : v.over ? 'Waiting for the host to show the winner.' : 'Waiting for the host to start the next round.');
  }

  function renderWin(v) {
    var w = v.scores[0] > v.scores[1] ? 0 : 1;
    tint('s-win', w);
    $('winTitle').textContent = teamName(w) + ' team wins';
    $('winScore').textContent = 'First to ' + v.settings.target + '. Final score ' + teamName(0) + ' ' + v.scores[0] + ', ' + teamName(1) + ' ' + v.scores[1] + '.';
    $('btnAgain').hidden = !v.isHost;
    $('btnSettings').hidden = !v.isHost;
    hint('winHint', v.isHost ? '' : 'Waiting for the host to start a new game.');
  }

  function renderLobby(v) {
    $('lobbyCode').textContent = roomCode;
    $('team-0').checked = v.myTeam === 0;
    $('team-1').checked = v.myTeam === 1;

    var box = $('lobbyTeams');
    box.textContent = '';
    TEAMS.forEach(function (team, t) {
      var col = document.createElement('div');
      col.className = 'score ' + team.cls;
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = team.name;
      var list = document.createElement('ul');
      var members = v.players.filter(function (p) { return p.team === t; });
      members.forEach(function (p) {
        var li = document.createElement('li');
        li.textContent = p.name;
        if (p.id === v.me) li.className = 'you';
        list.appendChild(li);
      });
      if (!members.length) {
        var none = document.createElement('li');
        none.className = 'empty';
        none.textContent = 'Nobody yet';
        list.appendChild(none);
      }
      col.appendChild(name);
      col.appendChild(list);
      box.appendChild(col);
    });
    var picking = v.players.filter(function (p) { return p.team === null; }).map(function (p) { return p.name; });
    if (picking.length) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.style.gridColumn = '1 / -1';
      p.textContent = 'Still picking a team: ' + picking.join(', ');
      box.appendChild(p);
    }

    var r = R.LENGTHS[v.settings.length];
    $('lobbySettings').textContent = 'Rounds of ' + r[0] + ' to ' + r[1] + ' seconds. First to ' + v.settings.target +
      ' points. ' + R.deckSize(v.settings) + ' phrases.';

    $('btnLobbyStart').hidden = !v.isHost;
    $('btnLobbyStart').disabled = !v.canStart;
    $('btnLobbySettings').hidden = !v.isHost;
    var status;
    if (v.myTeam === null) status = 'Pick a team.';
    else if (!v.isHost) status = 'Waiting for the host to start.';
    else if (!v.canStart) status = 'Each team needs at least one player.';
    else status = 'Start when everyone is in. Each team takes turns describing.';
    $('lobbyStatus').textContent = status;
  }

  var SCREEN_FOR = { setup: 's-setup', lobby: 's-lobby', ready: 's-play', playing: 's-play', result: 's-result', win: 's-win' };

  // opts.stay: redraw, but keep the current screen (the host is editing settings)
  function render(v, opts) {
    var was = prev;
    prev = v;

    if (v.phase === 'lobby') renderLobby(v);
    else if (v.phase === 'ready') renderReady(v);
    else if (v.phase === 'playing') renderPlaying(v);
    else if (v.phase === 'result') renderResult(v);
    else if (v.phase === 'win') renderWin(v);

    // Sounds and timers, from what changed since the last view.
    var wasPlaying = was && was.phase === 'playing';
    if (v.phase === 'playing') {
      clock.endsAt = performance.now() + v.msLeft;
      clock.total = v.roundMs || 1;
      if (!wasPlaying) { lockScreen(); tick(); }
      else if (was.holding !== v.holding) tone(520, 0.05, 'triangle', 0.12);
    } else if (wasPlaying) {
      stopBeeps();
      unlockScreen();
      if (v.phase === 'result') {
        tone(110, 1.0, 'sawtooth', 0.35);
        tone(165, 1.0, 'sawtooth', 0.2);
        vibrate([200, 80, 400]);
      }
    }

    if (!(opts && opts.stay)) show(SCREEN_FOR[v.phase]);
  }

  // Leaving a game: forget the last view and stop anything running.
  function reset() {
    prev = null;
    roomCode = '';
    stopBeeps();
    unlockScreen();
  }

  loadSettings();
  initSetup();

  PP.ui = {
    $: $, show: show, render: render, reset: reset, setRoom: setRoom,
    setupFor: setupFor, setupStatus: setupStatus, busy: busy,
    settings: function () { return settings; }
  };
})(window.PP = window.PP || {});
