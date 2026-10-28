# Phrase Potato relay

A Cloudflare Worker that passes online-game messages between a host and its
guests. One Durable Object per room code; the host's browser still runs the rules.

Used by both Phrase Potato and Neural Neighbours. Each game has its own copy of
the client in its `net.js`; room codes are shared, so a code only ever belongs
to one game at a time.

## Run locally

```
npm install
npm run dev                                  # relay on ws://localhost:8787
cd .. && python3 -m http.server 8765         # site on http://localhost:8765
```

Pages served from `localhost` use the local relay automatically (see `RELAY_URL`
in `phrase-potato/net.js`). Allowed local origins are in `.dev.vars`.

## Deploy

```
npx wrangler login
npm run deploy
```

Then set the production `RELAY_URL` in `phrase-potato/net.js` to the
`wss://` URL wrangler prints. Allowed production origins are `ALLOWED_ORIGINS`
in `wrangler.jsonc`.
