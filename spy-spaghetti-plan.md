# Spy Spaghetti — a Codenames-style game

## Context
The site (`index.html`, static, GitHub Pages at games.isobotka.ca) has two party games, Phrase Potato and Neural Neighbours. Both use the same architecture: plain-script IIFEs on a namespace (`window.PP` / `window.NN`), pure `rules.js` reducer (`newState / reduce / viewFor`), `net.js` that runs the reducer on the host and ships per-player views through the Cloudflare relay (`relay/`), `ui.js` that only renders views, `main.js` that turns taps into actions, `shared/game.css` for the look. The user wants a third game, Codenames-style, built the same way. Neural Neighbours is the closest template (teams, a hidden-info role, per-player views).

Decisions from the user:
- Name **Spy Spaghetti**, folder `spy-spaghetti/`, namespace `window.SS`.
- **Online only** (no Single Device mode; mode screen has just Host / Join).
- Clue is **said out loud**; spymaster only picks the number and taps "I've said my clue".
- Operatives **tap to mark** a card (everyone on the team sees the marks), then a separate **Lock it in** button reveals it.

## Files to create (`spy-spaghetti/`)

### `decks.js`
`SS.WORDS = [...]` — ~400 single, family-friendly nouns, uppercase-safe, short enough for a 5-wide phone grid (aim ≤ 10 letters).

### `rules.js` (pattern: `neural-neighbours/rules.js`)
Reuse verbatim: `has`, `clone`, `cleanName`, `shuffle`, `findPlayer`, `teamOf`, `HOST`, `MAX_PLAYERS = 16`, `TEAMS` (Teal / Magenta, `t0` / `t1`).

State:
```
online: true, phase: 'lobby' | 'clue' | 'guess' | 'win',
players: [{ id, name, team: 0|1|null, spy: bool }],
cards: [{ word, key: 0|1|'n'|'x', shown: bool }]   // 25; 9 for starter, 8 other, 7 neutral, 1 assassin
start, active, count: null|0..9|'inf', left,        // guesses left this turn (count+1; unlimited for 0/'inf')
guessed: 0,                                          // picks this turn (needed before End turn)
marks: { playerId: cardIndex },
log: [{ team, count, picks: [word...] }],
winner: null, reason: null ('agents' | 'assassin')
```
Actions (all sender-checked; `from` is filled by the session as now):
- `JOIN`, `LEAVE`, `SET_NAME` — as in NN. On LEAVE drop their mark; if they were a spymaster their slot empties (see CLAIM).
- `SET_TEAM {team}` — in lobby; also mid-game if the player has no team yet (late joiners join as operatives). Switching team clears `spy`.
- `SET_SPY {on}` — become/stop being your team's spymaster. Allowed only if the slot is free. Allowed in lobby, or mid-game when the slot is empty (spymaster left), so the game can continue.
- `START_GAME` (host) — needs each team: 1 spymaster + ≥1 operative. Deal 25 words from a shuffled `SS.WORDS`, random starting team gets 9, build key, `phase = 'clue'`, clear log/marks.
- `CLUE {count}` — active spymaster only, phase `clue`; `count` ∈ 0..9 or `'inf'`; push log entry; `phase = 'guess'`.
- `MARK {card}` — active-team operative, unrevealed card; toggles their single mark.
- `LOCK` — active-team operative reveals the card **they** have marked. Outcome: own colour → `left--`, end turn at 0; other team's / neutral → end turn; assassin → other team wins. After any reveal, a team with all cards shown wins. Clears marks on that card.
- `PASS` — active operative, after ≥1 guess this turn: end turn.
- `END` (host) — back to lobby (keeps teams and roles).
- End turn = clear marks, `active = 1 - active`, `phase = 'clue'`.

`viewFor(s, id)`: players, me, isHost, myTeam, amSpy, phase, active, `cards` with `key` included only if card is shown, or the viewer is a spymaster, or `phase === 'win'`; `remaining` per team; count/left; marks as `{ card: [names] }` (only for the viewer's team — keeps the other team from copying); `myMark`; `canClue`, `canMark`, `canLock`, `canPass`, `canStart`; `needSpy` (active team has no spymaster); log; winner/reason.

### `net.js`
Copy `neural-neighbours/net.js`, rename `NN` → `SS`, update the header comment. No relay protocol changes.

### `ui.js` / `main.js` (pattern: NN's)
Reuse: `$`, `show`, `busy`, `box`, `nameSpan`, `hint`, `tint`, `setRoom`, `reset`, `render(v, opts)` dispatch via `SCREEN_FOR`, name in `localStorage` (`spy-spaghetti-name`), invite link `?join=ABCD` + share button, pagehide close, join flow (`openJoin` / `join`), `btnAdmin` stays out (no admin controls yet).

Screens: `s-mode` (title, 3-line rules, Online: Host / Online: Join), `s-join`, `s-lobby`, `s-game`, `s-win`. No setup screen (no settings yet): Host goes straight to opening a room, with the busy label on the button and errors shown on the mode screen.
- Lobby: room code, share, name, team chips (Teal / Magenta), "I'll be the spymaster" toggle chip (disabled when taken), team boards listing members with a "spymaster" tag, status line ("Each team needs a spymaster and at least one operative").
- Game: bar (`Teal's turn` / remaining `Teal 6 : 5 Magenta`), clue line ("Clue for 2 · 3 guesses left"), 5×5 board of `<button class="card">` with team / neutral / assassin classes, revealed state, spymaster key tint for hidden cards, mark badges (initials) and a highlighted own mark. Below: spymaster number chips (0–9, ∞) + "I've said my clue"; operative "Lock it in" + "End turn"; "Take over as spymaster" when `needSpy` and you're on that team; team picker for late joiners; host "End game"; collapsible log.
- Win: tinted with winner, title ("Teal team wins"), reason line, full key visible on the board? (keep simple: text only, plus host buttons **Play again** → START_GAME, **Back to lobby** → END).
- Card taps: one delegated click listener on the board → `MARK`.

### `style.css`
Only game-specific bits: grid `repeat(5, 1fr)`, card sizing with `clamp()` font and `overflow-wrap: anywhere`, colours reusing `--t0`/`--t1`, a neutral tan and near-black assassin, spymaster-view stripes for hidden cards, mark badges. Widen `#s-game .inner` slightly (e.g. 40rem) for the board.

### `index.html`
Copy NN's head (Comic Neue font, `../shared/game.css`, `style.css`), nav banner, screens above, version `v0.1`, scripts `decks, rules, net, ui, main`.

## Files to edit
- `index.html` (home): add a `<tr>` for Spy Spaghetti ("Spymasters give one-word clues; find your agents and dodge the assassin.", 4+, Oct 2026); bump "last updated" to 2026-10-30.
- `relay/README.md` and the header comment in `relay/src/index.js`: say the relay serves all three games. No code change, so no redeploy needed (`MAX_GUESTS = 15` and rate limits already fit).
- New `spy-spaghetti/TODO.md` with follow-ups: setup screen with settings (turn timer, word lists), rotating spymasters on Play again, Single Device mode.

## Verification
1. Rules unit check with node: load `decks.js` + `rules.js` with `global.window = {}` and script a game — start conditions, clue, mark/lock outcomes (own, other, neutral, assassin), guess limit, pass, win by agents, spymaster leaving + claim, and that `viewFor` hides keys from operatives.
2. End to end: `npm run dev` in `relay/` (8787) + `python3 -m http.server 8765` at repo root; Playwright with 4 tabs on `http://localhost:8765/spy-spaghetti/` — host opens room, three join via code / invite link, pick teams and spymasters, play turns, check each tab only sees what it should, play to a win, Play again, Back to lobby, leave mid-game. Screenshot at phone width (≈390px) to check the 5×5 grid fits.
3. Click through from the home page link.
