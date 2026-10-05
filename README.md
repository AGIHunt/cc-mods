# AGI Hunt Mods

AGI Hunt 出品的 [Claude Code Mods](https://code.claude.com/docs/en/plugins/mods/overview)：在 Claude Code 里画面板、加提示、做小游戏的插件。欢迎一起来做。

## 安装

```
/plugin marketplace add AGIHunt/cc-mods
/plugin install hop@agihunt
```

## Mods

| Mod | 是什么 |
|---|---|
| [蹦一蹦 hop](plugins/hop) | 等 Claude 干活时玩的跳一跳，每块方块带一张 AI 编程知识卡片，可选排行榜 |

## DeepSeek Harness 也能玩

蹦一蹦有一个 [DeepSeek Harness 版](dsh/hop)（主角是小鲸鱼）。在 DSH 侧栏 **插件 → 添加插件** 填入：

```
github:AGIHunt/cc-mods#path:dsh/hop
```

或者命令行：`dsh plugin --profile desktop add "github:AGIHunt/cc-mods#path:dsh/hop"`。

## 参与

- 加一张知识卡片：改 [`plugins/hop/data/facts.json`](plugins/hop/data/facts.json) 提 PR
- 改进蹦一蹦：看 [plugins/hop/README.md](plugins/hop/README.md) 的代码地图
- 做一个新 Mod：`cp -r templates/starter-mod plugins/my-mod`

详细步骤、Mod 守则和桌面端踩过的坑都在 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

Claude Code mods by [AGI Hunt](https://agihunt.info). Install with the two commands above. Hop also runs in DeepSeek Harness: add `github:AGIHunt/cc-mods#path:dsh/hop` under Plugins → Add plugin. Contributions welcome: new trivia cards, improvements to Hop, or brand-new mods. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

[MIT License](LICENSE)
