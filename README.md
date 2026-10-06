# AGI Hunt Mods

**English** · [简体中文](README.zh-CN.md)

[Claude Code Mods](https://code.claude.com/docs/en/plugins/mods/overview) by [AGI Hunt](https://agihunt.info): plugins that draw panes, add hints and run small games inside Claude Code. Contributions welcome.

<p align="center">
  <img src="docs/hop-demo.gif" alt="Hop in Claude Code" width="380" />
  &nbsp;
  <img src="docs/hop-dsh.gif" alt="Hop in DeepSeek Harness" width="380" />
</p>

## Install

In Claude Code (desktop app, 2.1.287 or later):

```
/plugin marketplace add AGIHunt/cc-mods
/plugin install hop@agihunt
```

## Mods

| Mod | What it is |
|---|---|
| [Hop](plugins/hop) | A hop game to play while Claude works. Hold Space to charge, release to jump. Every block carries an AI coding tip (596 cards on Claude Code, Codex, DeepSeek Harness, Cursor and more). Optional leaderboard. |

## Also runs in DeepSeek Harness

Hop has a [DeepSeek Harness version](dsh/hop) where the hero is a little whale. In DSH, open **Plugins → Add plugin** and paste:

```
github:AGIHunt/cc-mods#path:dsh/hop
```

Or from the command line: `dsh plugin --profile desktop add "github:AGIHunt/cc-mods#path:dsh/hop"`.

## Language

Hop speaks English and Chinese.

- **Claude Code:** follows your system language. To force one, run `/plugin`, open **hop**, and set **Language** to `en` or `zh` (`auto` follows the system). Start a new session to apply it.
- **DeepSeek Harness:** follows the DSH interface language (Settings → Language).

## Contributing

- Add a knowledge card: edit [`plugins/hop/data/facts.json`](plugins/hop/data/facts.json) and open a PR
- Improve Hop: see the code map in [plugins/hop/README.md](plugins/hop/README.md)
- Build a new mod: `cp -r templates/starter-mod plugins/my-mod`

Step-by-step setup, the mod guidelines and the desktop pitfalls we hit are in [CONTRIBUTING.md](CONTRIBUTING.md).

[MIT License](LICENSE)
