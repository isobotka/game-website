/* Neural Neighbours: getting actions to the rules and views back to the screens.

   All three ways to play look the same to the rest of the code:
     send(action)  pass a player's tap on to the rules
     close()       stop and disconnect
   and they call onView(view) whenever this device should redraw.

   Local: the rules run right here.
   Host:  the rules run here, and every guest gets their own view through the relay.
   Guest: taps go to the host, views come back.

   The relay (see relay/ at the top of the repo) is a small server that only
   passes messages along, so it works on any network. It is shared with
   Phrase Potato; this file is a copy of phrase-potato/net.js without the buzzer. */
(function (NN) {
  'use strict';

  var R = NN.rules;
  // Pages served from this machine talk to `npm run dev` in relay/.
  var RELAY_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? 'ws://' + location.hostname + ':8787'
    : 'wss://phrase-potato-relay.isob.workers.dev';
  var PING_MS = 30000; // keeps idle connections from being dropped along the way
  var CLOSE = { HOST_LEFT: 4000, NO_ROOM: 4004, TOO_FAST: 4008, TAKEN: 4009, FULL: 4029 }; // as in relay/src/index.js
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O, they look like 1 and 0

  /* ---------- the session: holds the state ---------- */
  function Session(online, onView) {
    this.state = R.newState(online);
    this.onView = onView;
    this.conns = {};   // guest id -> { send(message) }
  }
  Session.prototype.dispatch = function (action, from) {
    if (!action || typeof action.type !== 'string') return;
    var a = {};
    for (var k in action) if (Object.prototype.hasOwnProperty.call(action, k)) a[k] = action[k];
    a.from = from;
    var next = R.reduce(this.state, a);
    if (next === this.state) return;
    this.state = next;
    this.broadcast();
  };
  Session.prototype.broadcast = function () {
    this.onView(R.viewFor(this.state, R.HOST));
    for (var id in this.conns) {
      try { this.conns[id].send({ t: 'view', v: R.viewFor(this.state, id) }); } catch (e) { /* dropped: close handler cleans up */ }
    }
  };
  Session.prototype.send = function (action) { this.dispatch(action, R.HOST); };
  Session.prototype.close = function () {
    this.conns = {};
    var ws = this.ws;
    this.ws = null; // the relay tells the guests we left
    if (ws) ws.close(1000);
  };

  /* ---------- the relay ---------- */
  function openSocket(code, role) {
    var ws = new WebSocket(RELAY_URL + '/room/' + code + '?role=' + role);
    var ping = setInterval(function () { if (ws.readyState === 1) ws.send('ping'); }, PING_MS);
    ws.addEventListener('close', function () { clearInterval(ping); });
    return ws;
  }
  function sendJSON(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
  function parse(data) {
    if (data === 'pong') return null;
    try { return JSON.parse(data); } catch (e) { return null; }
  }

  function randomCode() {
    var c = '';
    for (var i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return c;
  }
  function cleanCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); }

  /* ---------- local ---------- */
  function local(onView) {
    var s = new Session(false, onView);
    s.broadcast();
    return s;
  }

  /* ---------- host ---------- */
  // Resolves with the session once the room code is registered.
  // onStatus(message) reports trouble after that.
  function host(name, onView, onStatus) {
    return new Promise(function (resolve, reject) {
      var session = new Session(true, onView);
      var tries = 0;

      function open() {
        var code = randomCode();
        var ws = openSocket(code, 'host');
        var ready = false;
        session.ws = ws;

        ws.addEventListener('message', function (e) {
          var msg = parse(e.data);
          if (!msg) return;
          if (msg.t === 'ready' && !ready) {
            ready = true;
            session.code = code;
            session.dispatch({ type: 'JOIN', name: name }, R.HOST);
            resolve(session);
          } else if (msg.t === 'join') {
            session.conns[msg.id] = guestConn(ws, msg.id);
          } else if (msg.t === 'msg') {
            var d = msg.d;
            if (session.conns[msg.id] && d && d.t === 'act' && d.a && typeof d.a === 'object') session.dispatch(d.a, msg.id);
          } else if (msg.t === 'leave') {
            if (!session.conns[msg.id]) return;
            delete session.conns[msg.id];
            session.dispatch({ type: 'LEAVE' }, msg.id);
          }
        });
        ws.addEventListener('close', function (e) {
          if (session.ws !== ws) return; // we closed it on purpose
          if (!ready && e.code === CLOSE.TAKEN && tries++ < 5) { open(); return; }
          if (!ready) { session.close(); reject(new Error(describeClose(e.code, false))); return; }
          session.ws = null;
          onStatus('Lost the connection to the game server. Leave and open a new room.');
        });
      }
      open();
    });
  }

  function guestConn(ws, id) {
    return { send: function (msg) { sendJSON(ws, { t: 'to', id: id, d: msg }); } };
  }

  /* ---------- guest ---------- */
  // Resolves once connected to the host. onStatus(message) is called if the
  // connection drops later.
  function guest(code, name, onView, onStatus) {
    code = cleanCode(code);
    if (code.length !== 4) return Promise.reject(new Error('Room codes are 4 letters.'));
    return new Promise(function (resolve, reject) {
      var ws = openSocket(code, 'guest');
      var ready = false;
      var closed = false;
      var api = {
        code: code,
        send: function (a) { sendJSON(ws, { t: 'act', a: a }); },
        close: function () { closed = true; ws.close(1000); }
      };
      function fail(message) {
        if (closed) return;
        api.close();
        if (!ready) reject(new Error(message));
        else onStatus(message);
      }

      ws.addEventListener('message', function (e) {
        var msg = parse(e.data);
        if (!msg) return;
        if (msg.t === 'ready' && !ready) {
          ready = true;
          api.send({ type: 'JOIN', name: name });
          resolve(api);
        } else if (msg.t === 'view' && msg.v) {
          onView(msg.v);
        }
      });
      ws.addEventListener('close', function (e) { fail(describeClose(e.code, ready)); });
      // If the server never answers, don't hang forever.
      setTimeout(function () { if (!ready) fail('Could not reach the game server. Check your connection.'); }, 15000);
    });
  }

  function describeClose(code, wasReady) {
    switch (code) {
      case CLOSE.NO_ROOM: return 'No game with that code. Check it and try again.';
      case CLOSE.HOST_LEFT: return 'The host left the game.';
      case CLOSE.FULL: return 'That game is full.';
      case CLOSE.TAKEN: return 'Could not open a room. Try again.';
      case CLOSE.TOO_FAST: return 'Too many messages too quickly. Join again.';
      default: return wasReady ? 'Lost the connection to the game server.' : 'Could not reach the game server. Check your connection.';
    }
  }

  NN.net = { local: local, host: host, guest: guest, cleanCode: cleanCode };
})(window.NN = window.NN || {});
