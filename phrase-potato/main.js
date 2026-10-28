/* Phrase Potato: buttons. Picks how we're playing, then turns taps into actions
   for the rules. Nothing in here decides what a tap does to the game. */
(function (PP) {
  'use strict';

  var ui = PP.ui, net = PP.net;
  var $ = ui.$;
  var NAME_KEY = 'phrase-potato-name';

  var mode = null;      // 'local' | 'host' | 'guest'
  var game = null;      // whatever net gave us: has send() and close()
  var view = null;      // the latest view, for redrawing after leaving settings
  var editing = false;  // the host is on the settings screen while the room stays open

  function onView(v) {
    view = v;
    ui.render(v, { stay: editing });
  }
  function send(action) { if (game) game.send(action); }

  function sendSettings() { send({ type: 'SETTINGS', settings: ui.settings() }); }

  function leave() {
    if (game) game.close();
    game = null;
    mode = null;
    view = null;
    editing = false;
    ui.reset();
    ui.show('s-mode');
  }

  /* ---------- name, kept on this device ---------- */
  function loadName() {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; }
  }
  function saveName(name) {
    try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* ignore */ }
  }

  /* ---------- mode screen ---------- */
  $('btnLocal').addEventListener('click', function () {
    mode = 'local';
    ui.setupFor('local');
    game = net.local(onView);
  });

  $('btnHost').addEventListener('click', function () {
    mode = 'host';
    editing = true;
    ui.setupFor('host-new');
    ui.show('s-setup');
  });

  $('btnJoin').addEventListener('click', function () { openJoin(''); });

  /* ---------- setup screen ---------- */
  $('btnStart').addEventListener('click', function () {
    if (mode === 'local') {
      sendSettings();
      send({ type: 'START_GAME' });
    } else if (mode === 'host' && game) {
      editing = false;
      sendSettings();
    } else if (mode === 'host') {
      openRoom();
    }
  });

  $('btnSetupBack').addEventListener('click', function () {
    if (mode === 'host' && game) { editing = false; ui.render(view); }
    else leave();
  });

  function openRoom() {
    ui.setupStatus('');
    ui.busy('btnStart', 'Opening a room…');
    net.host(loadName(), onView, function (message) { $('lobbyStatus').textContent = message; })
      .then(function (session) {
        ui.busy('btnStart');
        if (mode !== 'host') { session.close(); return; } // they gave up and went back
        game = session;
        ui.setRoom(session.code);
        $('myName').value = loadName();
        editing = false;
        sendSettings();
      })
      .catch(function (err) {
        ui.busy('btnStart');
        ui.setupStatus(err.message);
      });
  }

  /* ---------- join screen ---------- */
  function openJoin(code, message) {
    $('joinCode').value = code;
    $('joinStatus').textContent = message || '';
    ui.show('s-join');
    if (!message) { try { $('joinCode').focus(); } catch (e) { /* ignore */ } }
  }

  function join() {
    var code = net.cleanCode($('joinCode').value);
    $('joinStatus').textContent = '';
    ui.busy('btnJoinGo', 'Connecting…');
    mode = 'guest';
    net.guest(code, loadName(), onView, function (message) {
      leave();
      openJoin(code, message);
    })
      .then(function (api) {
        ui.busy('btnJoinGo');
        if (mode !== 'guest') { api.close(); return; }
        game = api;
        ui.setRoom(api.code);
        $('myName').value = loadName();
      })
      .catch(function (err) {
        ui.busy('btnJoinGo');
        mode = null;
        $('joinStatus').textContent = err.message;
      });
  }

  $('btnJoinGo').addEventListener('click', join);
  $('joinCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
  $('joinCode').addEventListener('input', function () {
    var clean = net.cleanCode($('joinCode').value);
    if (clean !== $('joinCode').value) $('joinCode').value = clean;
  });
  $('btnJoinBack').addEventListener('click', leave);

  /* ---------- lobby ---------- */
  var nameTimer = null;
  function sendName() {
    clearTimeout(nameTimer);
    var name = $('myName').value.trim();
    saveName(name);
    if (name) send({ type: 'SET_NAME', name: name });
  }
  $('myName').addEventListener('input', function () {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(sendName, 400);
  });
  $('myName').addEventListener('change', sendName);

  [0, 1].forEach(function (t) {
    $('team-' + t).addEventListener('change', function () {
      if ($('team-' + t).checked) send({ type: 'SET_TEAM', team: t });
    });
  });

  $('btnLobbyStart').addEventListener('click', function () { send({ type: 'START_GAME' }); });

  $('btnLobbySettings').addEventListener('click', function () {
    editing = true;
    ui.setupFor('host-room');
    ui.show('s-setup');
  });

  $('btnLeave').addEventListener('click', leave);

  $('btnShare').addEventListener('click', function () {
    var code = $('lobbyCode').textContent;
    var url = location.origin + location.pathname + '?join=' + code;
    var btn = $('btnShare');
    function done(text) {
      btn.textContent = text;
      setTimeout(function () { btn.textContent = 'Copy invite link'; }, 2000);
    }
    if (navigator.share) {
      navigator.share({ title: 'Phrase Potato', text: 'Join my Phrase Potato game. Room code ' + code, url: url })
        .catch(function () { /* closed the share sheet */ });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { done(url); });
    } else {
      done(url);
    }
  });

  /* ---------- play, result and win screens ---------- */
  $('btnGo').addEventListener('click', function () { send({ type: 'START_ROUND' }); });
  $('btnShuffle').addEventListener('click', function () { send({ type: 'SHUFFLE_ORDER' }); });
  $('turnOrder').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-team]');
    if (!b || !view) return;
    var t = parseInt(b.dataset.team, 10), i = parseInt(b.dataset.index, 10);
    var ids = view.order[t].map(function (p) { return p.id; });
    ids.splice(i - 1, 0, ids.splice(i, 1)[0]);
    send({ type: 'SET_ORDER', team: t, order: ids });
  });
  $('btnPass').addEventListener('click', function () { send({ type: 'PASS' }); });
  $('btnSkip').addEventListener('click', function () { send({ type: 'SKIP' }); });

  // Space bar passes too, for playing on a laptop. Held keys don't repeat it,
  // and it never lands on a focused button (Skip) or a text box instead.
  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' || e.repeat || $('s-play').hidden || $('btnPass').hidden) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    send({ type: 'PASS' });
  });
  $('btnNext').addEventListener('click', function () { send({ type: 'NEXT_ROUND' }); });
  $('btnEnd').addEventListener('click', function () { send({ type: 'END' }); });
  $('btnAgain').addEventListener('click', function () { send({ type: 'START_GAME' }); });
  $('btnSettings').addEventListener('click', function () {
    if (mode === 'host') {
      editing = true;
      ui.setupFor('host-room');
      ui.show('s-setup');
    }
    send({ type: 'END' });
  });

  // Close the connection when leaving the page, so the host notices right away.
  window.addEventListener('pagehide', function (e) { if (!e.persisted && game) game.close(); });

  // An invite link (?join=ABCD) goes straight to the join screen.
  var invite = net.cleanCode(new URLSearchParams(location.search).get('join'));
  if (invite) openJoin(invite);
})(window.PP = window.PP || {});
