# Contributing

**English** · [简体中文](CONTRIBUTING.zh-CN.md)

Play with it, change it, add to it. This repo is a Claude Code plugin marketplace; each mod is a folder under `plugins/`.

## What you can contribute

| You want to | Effort | Start here |
|---|---|---|
| Add knowledge cards to Hop, or fix outdated ones | Easiest | [Add cards](#add-knowledge-cards) |
| Improve Hop (gameplay, drawing, sounds, languages) | Medium | [plugins/hop/README.md](plugins/hop/README.md) |
| Build a brand-new mod (a small game or a tool) | Up to you | [Build a new mod](#build-a-new-mod) |

Not sure whether it'll work? Open an issue and talk it through first.

## Setup

- Claude Code **2.1.287 or later** (mods start with this version).
- Writing a mod needs no Node and no bundler: Claude Code loads `.ts` / `.tsx` directly. The repo's check scripts need Node 18+.

### Edit and preview in the terminal (fastest)

```bash
claude --plugin-dir plugins/hop
```

Save a file and the mod hot-reloads.

### Edit and preview in the desktop app

Add this to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/cc-mods/plugins/hop",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

Then start a new session in the desktop app. Edits reload automatically. Remove these two lines when you're done.

### Have Claude write it with you

Type `/plugin-authoring` in Claude Code and describe what you want. It knows every event and API in your version.

## Before you open a PR

```bash
claude plugin validate .                 # marketplace manifest
claude plugin validate plugins/<mod>     # the mod you changed
(cd plugins/<mod> && claude plugin test .)
node scripts/check-facts.mjs             # if you changed cards
```

CI runs the same checks on every PR.

> Desktop users: the desktop app ships its own `claude` (on macOS under `~/Library/Application Support/Claude/claude-code/<version>/…/claude`). The `claude` on your PATH may be older and validate differently. Use the one that matches what you actually run.

## Add knowledge cards

Cards live in [`plugins/hop/data/facts.json`](plugins/hop/data/facts.json). Append an entry:

```json
{
  "id": "yourname-001",
  "tag": { "zh": "小技巧", "en": "Tip" },
  "zh": "中文，单独拿出来就看得懂，约 60 个汉字以内。",
  "en": "English, standalone, 140 characters max.",
  "surface": "all",
  "source": "https://code.claude.com/docs/...",
  "asOf": "2026-10"
}
```

- `id`: prefix it with your GitHub username so it never collides.
- `zh` / `en`: both are required. If you only write one language, say so in the PR and we'll help with the other.
- `surface`: where it applies in Claude Code. `all` for everywhere; `cli` for the terminal; `desktop`, `ide`, `web`, `mobile`. Anything other than `all` gets a label on the card (and is skipped in the DeepSeek Harness version).
- `source`: required. Prefer official docs, official blogs, or the person's own post.
- `asOf`: year and month for anything that ages with versions; `null` if it won't.

**What gets in:** each card has to be at least one of: genuinely useful (you can use it right away) or genuinely fun (funny, surprising, a good story). No specs or benchmarks of superseded models; history only for real milestones. Keep it casual, like telling a friend.

Found an outdated or wrong card? Fix it and explain why in the PR, or open a "Card suggestion" issue.

## Build a new mod

```bash
cp -r templates/starter-mod plugins/my-mod
```

Rename every `starter-mod` to `my-mod`, then:

1. Register it under `plugins` in [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json).
2. Write `plugins/my-mod/README.md`: what it does, when it appears, how to use it, and whether it uses the network.
3. Add at least one `tests/*.test.tsx`.

Plugin names can't start with `claude-` or look like official plugins; validate will reject them.

### Mod guidelines

Mods in this repo aim for these, and reviews check them:

1. **Stay out of the conversation.** Draw UI and observe events only; don't add to the prompt unless that's the feature and the user knows it. Slash commands leave two lines in the transcript; Hop blanks them with `session.append`.
2. **Don't interrupt.** Don't pop anything up while Claude is idle. Don't open panes by default; give users a setting.
3. **Privacy.** If it uses the network, the README says what is sent and where. Nothing is sent by default; users opt in.
4. **Bilingual.** UI text in at least English and Chinese, following the system language (you can copy `plugins/hop/hooks/i18n.ts`).

## Desktop pitfalls we hit

Found while building Hop; a quick read saves a lot of time (as of Claude Code 2.1.286, desktop app 2.19675):

- **`Client` regions don't load in the desktop app.** The content security policy blocks them (`did not load within 10s`), so the desktop app can't get mouse down and up events; the terminal can.
- **`Svg` with `isInteractive` goes into an embedded frame** that reloads whenever the content changes, so it flickers. Without it, it's a plain image: swaps don't flicker, but SVG animations don't play. For animation, draw frame by frame and drive redraws with `$.state`; a visible pane redraws at most 30 times a second.
- **Button hotkeys don't receive key repeats while a key is held.** An input's `onInput` does, so you can detect hold and release from it. The system key repeat starts after about 0.45 s, so taps shorter than that can't be timed.
- **`$.ui.focus` only moves the pane's focus marker; it doesn't always hand over real keyboard focus.** Drawing a fresh input with `autoFocus` plus `$.ui.focus` is more reliable.
- **Frequent pane redraws make an input's focus ring flicker.** Don't redraw when nothing is animating.
- **Hot reload keeps `$.state`.** If you change the shape of your state, recognize the old shape or reset it.
- **JSX compiles to a global `h(...)`.** Don't name a variable `h`, or the pane won't draw.
- **`$` can't be passed to functions or stored in variables**; validate rejects it. Put shared logic in closures inside `session.start`.
- **Slash commands wait for the current turn to end by default.** Register with `immediate: true` for commands that should work while Claude is busy.
- **Desktop buttons show their hotkey themselves.** Don't write "(R)" in the label.
- **Writing tests.** Register `on(...)` in tests before the first `$` call. Use `mock.clock` and `mock.store` for time and storage.
