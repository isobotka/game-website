/* Phrase Potato: getting actions to the rules and views back to the screens.

   All three ways to play look the same to the rest of the code:
     send(action)  pass a player's tap on to the rules
     close()       stop and disconnect
   and they call onView(view) whenever this device should redraw.

   Local: the rules run right here.
   Host:  the rules run here, and every guest gets their own view over WebRTC.
   Guest: taps go to the host, views come back. */
(function (PP) {
  'use strict';

  var R = PP.rules;
  var PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  var PREFIX = 'phrasepotato-';
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L or O, they look like 1 and 0

  /* ---------- the session: holds the state and runs the buzzer ---------- */
  function Session(online, onView) {
    this.state = R.newState(online);
    this.onView = onView;
    this.conns = {};   // guest peer id -> connection
    this.timer = null;
    var self = this;
    this.onVisible = function () { if (document.visibilityState === 'visible') self.schedule(); };
    document.addEventListener('visibilitychange', this.onVisible);
  }
  Session.prototype.dispatch = function (action, from) {
    if (!action || typeof action.type !== 'string') return;
    var a = {};
    for (var k in action) if (Object.prototype.hasOwnProperty.call(action, k)) a[k] = action[k];
    a.from = from;
    a.now = Date.now();
    var next = R.reduce(this.state, a);
    if (next === this.state) return;
    this.state = next;
    this.schedule();
    this.broadcast();
  };
  // Only this timer ends a round. Re-armed after every change, and when the tab
  // comes back from the background, so a sleeping phone buzzes as soon as it wakes.
  Session.prototype.schedule = function () {
    clearTimeout(this.timer);
    this.timer = null;
    var s = this.state;
    if (s.phase !== 'playing') return;
    var self = this;
    var left = Math.max(0, s.roundMs - (Date.now() - s.roundStartedAt));
    this.timer = setTimeout(function () { self.dispatch({ type: 'BUZZ' }, R.TIMER); }, left);
  };
  Session.prototype.broadcast = function () {
    var now = Date.now();
    this.onView(R.viewFor(this.state, R.HOST, now));
    for (var id in this.conns) {
      try { this.conns[id].send({ t: 'view', v: R.viewFor(this.state, id, now) }); } catch (e) { /* dropped: close handler cleans up */ }
    }
  };
  Session.prototype.send = function (action) { this.dispatch(action, R.HOST); };
  Session.prototype.close = function () {
    clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onVisible);
    var conns = this.conns;
    this.conns = {};
    for (var id in conns) { try { conns[id].close(); } catch (e) { /* ignore */ } }
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ignore */ } }
  };

  /* ---------- PeerJS, loaded only when someone picks online ---------- */
  var peerjs = null;
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (peerjs) return peerjs;
    peerjs = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PEERJS_URL;
      s.onload = resolve;
      s.onerror = function () { peerjs = null; reject(new Error('Could not load the online library. Check your connection.')); };
      document.head.appendChild(s);
    });
    return peerjs;
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
    return loadPeerJS().then(function () {
      return new Promise(function (resolve, reject) {
        var session = new Session(true, onView);
        var tries = 0;

        function open() {
          var code = randomCode();
          var peer = new window.Peer(PREFIX + code);
          var ready = false;
          session.peer = peer;

          peer.on('open', function () {
            ready = true;
            session.code = code;
            session.dispatch({ type: 'JOIN', name: name }, R.HOST);
            resolve(session);
          });
          peer.on('connection', function (conn) { acceptGuest(session, conn); });
          // Lost the signalling server: existing players keep playing, but new
          // players can't join until we reconnect.
          peer.on('disconnected', function () {
            if (!peer.destroyed) { try { peer.reconnect(); } catch (e) { /* ignore */ } }
          });
          peer.on('error', function (err) {
            if (!ready && err.type === 'unavailable-id' && tries++ < 5) { peer.destroy(); open(); return; }
            if (!ready) { session.close(); reject(new Error(describeError(err))); return; }
            if (err.type !== 'peer-unavailable') onStatus(describeError(err));
          });
        }
        open();
      });
    });
  }

  function acceptGuest(session, conn) {
    var id = conn.peer;
    conn.on('open', function () { session.conns[id] = conn; });
    conn.on('data', function (msg) {
      if (msg && msg.t === 'act' && msg.a && typeof msg.a === 'object') session.dispatch(msg.a, id);
    });
    function gone() {
      if (!session.conns[id]) return;
      delete session.conns[id];
      session.dispatch({ type: 'LEAVE' }, id);
    }
    conn.on('close', gone);
    conn.on('error', gone);
  }

  /* ---------- guest ---------- */
  // Resolves once connected to the host. onStatus(message) is called if the
  // connection drops later.
  function guest(code, name, onView, onStatus) {
    code = cleanCode(code);
    if (code.length !== 4) return Promise.reject(new Error('Room codes are 4 letters.'));
    return loadPeerJS().then(function () {
      return new Promise(function (resolve, reject) {
        var peer = new window.Peer();
        var conn = null;
        var ready = false;
        var closed = false;
        var api = {
          code: code,
          send: function (a) { if (conn && conn.open) conn.send({ t: 'act', a: a }); },
          close: function () {
            closed = true;
            try { if (conn) conn.close(); } catch (e) { /* ignore */ }
            try { peer.destroy(); } catch (e) { /* ignore */ }
          }
        };
        function fail(message) {
          if (closed) return;
          if (!ready) { api.close(); reject(new Error(message)); return; }
          api.close();
          onStatus(message);
        }

        peer.on('open', function () {
          conn = peer.connect(PREFIX + code, { reliable: true });
          conn.on('open', function () {
            ready = true;
            api.send({ type: 'JOIN', name: name });
            resolve(api);
          });
          conn.on('data', function (msg) { if (msg && msg.t === 'view' && msg.v) onView(msg.v); });
          conn.on('close', function () { fail('The host left the game.'); });
          conn.on('error', function () { fail('Lost the connection to the host.'); });
        });
        peer.on('error', function (err) { fail(describeError(err)); });
        // A guest's own peer losing the signalling server is fine once connected.
        peer.on('disconnected', function () { if (!ready) fail('Could not reach the game server.'); });
        // If the host never answers, don't hang forever.
        setTimeout(function () { if (!ready) fail('No answer from that room. Check the code and try again.'); }, 15000);
      });
    });
  }

  function describeError(err) {
    switch (err && err.type) {
      case 'peer-unavailable': return 'No game with that code. Check it and try again.';
      case 'network':
      case 'server-error':
      case 'socket-error':
      case 'socket-closed': return 'Could not reach the game server. Check your connection.';
      case 'browser-incompatible': return 'This browser does not support online play.';
      default: return 'Something went wrong with the connection. Try again.';
    }
  }

  PP.net = { local: local, host: host, guest: guest, cleanCode: cleanCode };
})(window.PP = window.PP || {});
