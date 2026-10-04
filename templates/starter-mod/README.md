# starter-mod

新 Mod 的起步模板：一个 `/starter` 命令打开面板，面板里一个计数按钮。复制它开始写自己的 Mod：

```bash
cp -r templates/starter-mod plugins/my-mod
```

然后把 `starter-mod` 全部改成 `my-mod`（`plugin.json` 的 `name`、`hooks/register.tsx` 里的 `PANE` 和状态键、`types/index.d.ts`、测试里的 `plugin`）。详见仓库根目录的 [CONTRIBUTING.md](../../CONTRIBUTING.md)。
