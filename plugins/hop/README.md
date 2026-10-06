# Hop

**English** · [简体中文](README.zh-CN.md)

A hop game to play while Claude works. When a turn has been running for 5 seconds, a "Play Hop" hint appears above the prompt; you can also type `/hop` any time. Click the box under the game, hold Space to charge, release to jump.

- Every block carries an AI coding knowledge card (Claude Code, Codex, DeepSeek Harness, Cursor and more). Cards you haven't seen come first
- Land dead center for a perfect; chained perfects score more and more
- Difficulty ramps up with each jump and tops out around jump 45
- Sounds (played with macOS `afplay`); English and Chinese
- Optional [AGI Hunt](https://agihunt.info) leaderboard: only a nickname and scores are sent, and you can leave and delete your data any time

**Stays out of the conversation:** the pane, hint and cards are drawn in the UI only. The two lines `/hop` leaves in the transcript are blanked to "(no content)".
**Network:** only after you join the leaderboard does it call `https://agihunt.info/agent/v1/hop` (submit scores, fetch the board, leave and delete).
**Requires:** the Claude Code desktop app, 2.1.287 or later (the game is drawn with the desktop app's SVG surface; it doesn't show in the terminal).

## Settings

Run `/plugin` and open **hop**:

| Setting | Default | What it does |
|---|---|---|
| Hint while Claude works | on | Show the hint above the prompt during long turns |
| Hint after (seconds) | 5 | How long into a turn before the hint shows |
| Open the pane by itself | off | Open the game pane instead of only hinting |
| Language | `auto` | `auto` follows the system language; `en` or `zh` forces English or Chinese (start a new session to apply) |

## Code map

| File | What it does |
|---|---|
| `hooks/register.tsx` | All hooks: when to appear, key handling, frame-by-frame redraws, sounds, leaderboard requests, pane layout |
| `hooks/game.ts` | Pure game logic: block generation, jump physics, scoring, difficulty curve (no UI, easy to unit test) |
| `hooks/scene.ts` | Draws a game state as one static SVG frame: blocks, hero (or whale), animation, cards, results |
| `hooks/facts.ts` | Loads the knowledge cards and queues unseen ones first |
| `hooks/i18n.ts` | English and Chinese strings; add a language here |
| `data/facts.json` | Knowledge cards with sources; format in the repo's CONTRIBUTING |
| `sounds/*.wav` | Sounds synthesized by `scripts/make_sounds.py` in the repo; tweak and regenerate |
| `tests/` | Tests run by `claude plugin test` |

## Common tweaks

- **Feel / difficulty:** `SPEED` (distance per millisecond held) and `MAX_HOLD_MS` at the top of `game.ts`, and the difficulty curve in `nextBlock`.
- **New block kinds:** `SPECIAL` in `game.ts` (bonus points); `KIND_COLOR` and `decal` in `scene.ts` (looks).
- **Animation timing:** `FLY`, `PAN`, `DROP`, `POP` in `scene.ts`.
- **When it appears:** the `turn.start`, `classic.Notification` and `turn.complete` hooks in `register.tsx`.

The [DeepSeek Harness version](../../dsh/hop) reuses `game.ts`, `scene.ts`, `facts.ts`, `i18n.ts` and the cards; rebuild it after changing them.
