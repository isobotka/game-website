/* Spy Spaghetti: buttons. Picks how we're playing, then turns taps into
   actions for the rules. Nothing in here decides what an action does to the game. */
(function (SS) {
  'use strict';

  var ui = SS.ui, net = SS.net;
  var $ = ui.$;
  var NAME_KEY = 'spy-spaghetti-name';

  var mode = null;      // 'host' | 'guest'
  var game = null;      // whatever net gave us: has send() and close()

  function onView(v) { ui.render(v); }
  function send(action) { if (game) game.send(action); }

  function leave() {
    if (game) game.close();
    game = null;
    mode = null;
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
  $('btnHost').addEventListener('click', function () {
    mode = 'host';
    $('modeStatus').textContent = '';
    ui.busy('btnHost', 'Opening a room…');
    net.host(loadName(), onView, function (message) { $('lobbyStatus').textContent = message; })
      .then(function (session) {
        ui.busy('btnHost');
        if (mode !== 'host') { session.close(); return; }
        game = session;
        ui.setRoom(session.code);
        $('myName').value = loadName();
      })
      .catch(function (err) {
        ui.busy('btnHost');
        mode = null;
        $('modeStatus').textContent = err.message;
      });
  });

  $('btnJoin').addEventListener('click', function () { openJoin(''); });

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
    $('btnJoin' + t).addEventListener('click', function () { send({ type: 'SET_TEAM', team: t }); });
  });
  $('spyToggle').addEventListener('change', function () { send({ type: 'SET_SPY', on: $('spyToggle').checked }); });

  $('btnLobbyStart').addEventListener('click', function () { send({ type: 'START_GAME' }); });
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
      navigator.share({ title: 'Spy Spaghetti', text: 'Join my Spy Spaghetti game. Room code ' + code, url: url })
        .catch(function () { /* closed the share sheet */ });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { done(url); });
    } else {
      done(url);
    }
  });

  /* ---------- the board ---------- */
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-card]');
    if (b && !b.disabled) send({ type: 'MARK', card: parseInt(b.dataset.card, 10) });
  });
  $('counts').addEventListener('change', ui.countChanged);
  $('btnClue').addEventListener('click', function () {
    var count = ui.pickedCount();
    if (count !== null) send({ type: 'CLUE', count: count });
  });
  $('btnLock').addEventListener('click', function () { send({ type: 'LOCK' }); });
  $('btnPass').addEventListener('click', function () { send({ type: 'PASS' }); });
  $('btnTakeSpy').addEventListener('click', function () { send({ type: 'SET_SPY', on: true }); });
  $('btnEnd').addEventListener('click', function () {
    if (confirm('End this game for everyone and go back to the lobby?')) send({ type: 'END' });
  });

  /* ---------- win screen ---------- */
  $('btnAgain').addEventListener('click', function () { send({ type: 'START_GAME' }); });
  $('btnLobby').addEventListener('click', function () { send({ type: 'END' }); });

  // Close the connection when leaving the page, so the host notices right away.
  window.addEventListener('pagehide', function (e) { if (!e.persisted && game) game.close(); });

  // An invite link (?join=ABCD) goes straight to the join screen.
  var invite = net.cleanCode(new URLSearchParams(location.search).get('join'));
  if (invite) openJoin(invite);
})(window.SS = window.SS || {});
