import { DurableObject } from 'cloudflare:workers';

/* Game relay (Phrase Potato, Neural Neighbours, Spy Spaghetti): passes
   messages between a host and its guests.

   One Durable Object per room code. The host's browser still runs the rules;
   this only forwards:
     guest -> host   any JSON, delivered as { t: 'msg', id, d }
     host  -> guest  { t: 'to', id, d } delivers d to that guest
   and tells the host { t: 'join', id } / { t: 'leave', id }.
   Everyone gets { t: 'ready' } once they're in the room.

   Close codes the client understands: */
const CLOSE = {
  HOST_LEFT: 4000,
  NO_ROOM: 4004,
  TOO_FAST: 4008,
  TAKEN: 4009,
  FULL: 4029
};

const CODE = /^[A-HJKMNP-Z]{4}$/; // matches CODE_CHARS in shared/net.js
const MAX_GUESTS = 15;            // rules.js allows 16 players, host included
const MAX_MESSAGE = 16 * 1024;
// Messages a connection may send at once, refilled per second. The host sends
// one view per guest on every change, so it gets far more room than a guest.
const LIMITS = { host: { burst: 600, perSecond: 150 }, guest: { burst: 40, perSecond: 10 } };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Z]{4})$/);
    if (!match || !CODE.test(match[1])) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });

    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });

    const role = url.searchParams.get('role');
    if (role !== 'host' && role !== 'guest') return new Response('Bad role', { status: 400 });

    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keepalive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.buckets = new WeakMap(); // ws -> { tokens, at }; forgotten on hibernation, which is fine
  }

  async fetch(request) {
    const role = new URL(request.url).searchParams.get('role');
    const [client, server] = Object.values(new WebSocketPair());

    if (role === 'host') {
      if (this.host()) return refuse(client, server, CLOSE.TAKEN, 'Room code in use');
      this.ctx.acceptWebSocket(server, ['host']);
      server.serializeAttachment({ role: 'host' });
    } else {
      const host = this.host();
      if (!host) return refuse(client, server, CLOSE.NO_ROOM, 'No game with that code');
      if (this.ctx.getWebSockets('guest').length >= MAX_GUESTS) return refuse(client, server, CLOSE.FULL, 'Game is full');
      const id = 'g' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      this.ctx.acceptWebSocket(server, ['guest', 'g:' + id]);
      server.serializeAttachment({ role: 'guest', id });
      send(host, { t: 'join', id });
    }
    send(server, { t: 'ready' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return ws.close(1009, 'Message too big');
    const me = ws.deserializeAttachment();
    if (!this.allow(ws, me.role)) return ws.close(CLOSE.TOO_FAST, 'Too many messages');
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (me.role === 'host') {
      if (!msg || msg.t !== 'to' || typeof msg.id !== 'string') return;
      const guest = this.ctx.getWebSockets('g:' + msg.id)[0];
      if (guest) send(guest, msg.d);
    } else {
      const host = this.host();
      if (host) send(host, { t: 'msg', id: me.id, d: msg });
    }
  }

  async webSocketClose(ws) { this.gone(ws); }
  async webSocketError(ws) { this.gone(ws); }

  gone(ws) {
    try { ws.close(1000, 'Bye'); } catch (e) { /* already closed */ }
    const me = ws.deserializeAttachment();
    if (!me) return;
    if (me.role === 'host') {
      for (const guest of this.ctx.getWebSockets('guest')) {
        try { guest.close(CLOSE.HOST_LEFT, 'The host left'); } catch (e) { /* ignore */ }
      }
    } else {
      const host = this.host();
      if (host) send(host, { t: 'leave', id: me.id });
    }
  }

  // The open host socket, if any. A closing one doesn't count, so a host can
  // reopen the same code straight after leaving.
  host() {
    return this.ctx.getWebSockets('host').find((ws) => ws.readyState === WebSocket.OPEN);
  }

  // Token bucket per connection.
  allow(ws, role) {
    const limit = LIMITS[role];
    const now = Date.now();
    const b = this.buckets.get(ws) || { tokens: limit.burst, at: now };
    b.tokens = Math.min(limit.burst, b.tokens + ((now - b.at) / 1000) * limit.perSecond);
    b.at = now;
    this.buckets.set(ws, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }
}

function send(ws, msg) {
  try { ws.send(JSON.stringify(msg)); } catch (e) { /* closed: its close handler cleans up */ }
}

// Accept just long enough to tell the browser why, so it can show a real message.
function refuse(client, server, code, reason) {
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}
