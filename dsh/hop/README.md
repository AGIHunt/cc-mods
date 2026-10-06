# Hop for DeepSeek Harness

**English** · [简体中文](README.zh-CN.md)

A hop game to play while DeepSeek works. It's the same game as the [Claude Code mod](../../plugins/hop) (same game logic, drawing and knowledge cards), with a little whale as the hero.

- Open it from **Start** in the right sidebar. When a DeepSeek turn has been running for 5 seconds, a hint also appears above the composer; one click starts a round
- Click the game, **hold Space (or the mouse button) to charge, release to jump**
- Every block carries an AI coding knowledge card; cards you haven't seen come first
- Sounds, English and Chinese (follows the DSH interface language), difficulty ramps up with each jump
- Optional [AGI Hunt](https://agihunt.info) leaderboard, shared with the Claude Code version: only a nickname and scores are sent, and you can leave and delete your data any time
- Best score, seen cards and your leaderboard identity are kept in local browser storage

**Network:** only after you finish a round and choose to join the leaderboard does it call `https://agihunt.info/agent/v1/hop` (submit scores, fetch the board, leave and delete). Nothing is sent otherwise.

## Install

Requires DeepSeek Harness 0.2 or later (desktop app or `dsh web`).

**Desktop / Web:** in the sidebar open **Plugins → Add plugin**, paste the line below, click **Install**, then **Enable now**:

```
github:AGIHunt/cc-mods#path:dsh/hop
```

**Command line:**

```bash
dsh plugin --profile desktop add "github:AGIHunt/cc-mods#path:dsh/hop"
```

(Replace `desktop` with your profile, e.g. `web`.) To upgrade, uninstall it and install again the same way.

## How it differs from the Claude Code version

DSH's Claude Code Mods compatibility layer can currently only draw a text band above the composer, which can't host a game. So this is a native DSH plugin: the browser half registers a right-sidebar tab and the hint above the composer, and the game logic and drawing are reused from `plugins/hop/hooks`.

- Only general-purpose cards are shown (cards that apply only to one Claude Code surface are skipped)

## Development

```bash
npm install
npm run build            # builds client.js (bundles the game code from ../../plugins/hop/hooks, the cards and the sounds)
dsh plugin --profile web add "$(pwd)"   # installs it as a local link; rebuild and refresh the page after changes
```

- `src/client.tsx`: browser entry; registers the sidebar tab and the hint, handles keys, mouse, sounds and local saves
- `index.js`: host half; does nothing
- `cordis.patch.yml`, `locale/*.json`, `icon.svg`: the DSH bundle manifest, plugin name and icon

After changing `plugins/hop/hooks` or the cards, run `npm run build` again and commit `client.js` with it (installing from GitHub doesn't run a build).
