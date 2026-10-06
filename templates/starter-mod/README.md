# starter-mod

**English** · [简体中文](README.zh-CN.md)

A starter template for a new mod: a `/starter` command opens a pane with a counter button. Copy it to start your own:

```bash
cp -r templates/starter-mod plugins/my-mod
```

Then rename every `starter-mod` to `my-mod` (`name` in `plugin.json`, `PANE` and the state keys in `hooks/register.tsx`, `types/index.d.ts`, and `plugin` in the tests). See [CONTRIBUTING.md](../../CONTRIBUTING.md) at the repo root.
