#!/usr/bin/env bash
# Runs the site and the game relay locally. Ctrl+C stops both.
#   site:  http://localhost:8765
#   relay: ws://localhost:8787 (pages on localhost use it automatically)
set -euo pipefail
cd "$(dirname "$0")"

# Stop everything this script started, including wrangler's child processes.
trap 'trap "" INT TERM; trap - EXIT; kill 0 2>/dev/null' INT TERM EXIT

# wrangler (the relay) needs Node 22 or newer.
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -lt 22 ]; then
  echo "The relay needs Node.js 22 or newer; this is $(node -v 2>/dev/null || echo 'no node')."
  echo "With nvm: nvm install 22 && nvm alias default 22"
  exit 1
fi

if [ ! -d relay/node_modules ]; then
  (cd relay && npm install)
fi

(cd relay && npm run dev) &
python3 -m http.server 8765 &

echo
echo "  Site:  http://localhost:8765"
echo "  Relay: ws://localhost:8787"
echo "  Ctrl+C to stop both."
echo

# If either one stops (or fails to start), stop the other too.
wait -n || true
echo "One of the servers stopped, so stopping the other."
