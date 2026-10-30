# Phrase Potato relay

A Cloudflare Worker that passes online-game messages between a host and its
guests. One Durable Object per room code; the host's browser still runs the rules.

Used by Phrase Potato, Neural Neighbours and Spy Spaghetti. The client is `shared/net.js`, used
by every game; room codes are shared, so a code only ever belongs
to one game at a time.

## Run locally

`./dev.sh` at the top of the repo starts both of these, and Ctrl+C stops both.
Or by hand:

```
npm install
npm run dev                                  # relay on ws://localhost:8787
cd .. && python3 -m http.server 8765         # site on http://localhost:8765
```

Pages served from `localhost` use the local relay automatically (see `RELAY_URL`
in `shared/net.js`). Allowed local origins are in `.dev.vars`.

## Deploy

```
npx wrangler login
npm run deploy
```

Then set the production `RELAY_URL` in `shared/net.js` to the
`wss://` URL wrangler prints. Allowed production origins are `ALLOWED_ORIGINS`
in `wrangler.jsonc`.
