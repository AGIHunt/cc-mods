# 参与贡献 / Contributing

欢迎来玩、来改、来加新东西。这个仓库是一个 Claude Code 插件市场（marketplace），每个 Mod 是 `plugins/` 下的一个文件夹。

> English summary at the bottom.

## 你可以贡献什么

| 想做的事 | 难度 | 从哪开始 |
|---|---|---|
| 给蹦一蹦加冷知识卡片、纠正过时的卡片 | 最容易 | [加卡片](#加冷知识卡片) |
| 改进蹦一蹦（玩法、画面、音效、语言） | 中等 | [plugins/hop/README.md](plugins/hop/README.md) |
| 做一个全新的 Mod（小游戏、小工具都行） | 看你想做什么 | [做一个新 Mod](#做一个新-mod) |

不确定做不做得成，先开个 issue 聊聊也行。

## 开发环境

- Claude Code **2.1.287 或更新**（Mods 从这个版本开始有）。
- 写 Mod 不需要 Node、不需要打包：`.ts` / `.tsx` 直接被 Claude Code 加载。跑仓库里的检查脚本需要 Node 18+。

### 在终端里边改边看（最快）

```bash
claude --plugin-dir plugins/hop
```

改完文件保存，Mod 会自动热重载。

### 在桌面端里边改边看

在 `~/.claude/settings.json` 里加：

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/你的路径/cc-mods/plugins/hop",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

然后在桌面端新开一个会话。改完文件会自动重载。开发完记得删掉这两行。

### 让 Claude 帮你写

在 Claude Code 里输入 `/plugin-authoring`，再描述你想要什么。它知道当前版本所有的事件和接口。

## 提 PR 之前

```bash
claude plugin validate .                 # 市场清单
claude plugin validate plugins/<mod>     # 你改的 Mod
(cd plugins/<mod> && claude plugin test .)
node scripts/check-facts.mjs             # 改了卡片时
```

GitHub 上的 CI 会对每个 PR 跑同样的检查。

> 用桌面端的人注意：桌面端自带一份 claude（macOS 在 `~/Library/Application Support/Claude/claude-code/<版本>/…/claude`），PATH 里的 `claude` 可能是更旧的版本，校验结果会不一样。以和你实际运行的版本一致为准。

## 加冷知识卡片

卡片都在 [`plugins/hop/data/facts.json`](plugins/hop/data/facts.json)。往数组末尾加一项：

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

- `id`：用你的 GitHub 用户名做前缀，不会和别人撞。
- `surface`：这条只在哪个端成立。`all` 通用；`cli` 终端；`desktop`、`ide`、`web`、`mobile`。不是通用的，卡片上会标出来。
- `source`：必填，出处链接，优先官方文档、官方博客、本人原帖。
- `asOf`：会随版本过时的内容写上年月，不会过时的写 `null`。

**什么样的卡片会被收：** 至少做到一样：真有用（看完马上能用上），或真有趣（好笑、意外、有故事）。讲已经被替代的旧模型参数、跑分的不收；历史类只收真正的里程碑。口语化，像给朋友讲。

发现某张卡片过时或写错了，直接改它，PR 里说明原因；或者用「冷知识卡片建议」开个 issue。

## 做一个新 Mod

```bash
cp -r templates/starter-mod plugins/my-mod
```

把 `starter-mod` 全部改成 `my-mod`，然后：

1. 在 [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) 的 `plugins` 里登记它。
2. 写一个 `plugins/my-mod/README.md`：它做什么、什么时候出现、怎么用、联不联网。
3. 至少写一个 `tests/*.test.tsx`。

插件名不能以 `claude-` 开头，也不要像官方插件，validate 会拦。

### Mod 守则

这个仓库里的 Mod 都尽量做到这几条，评审时也会看：

1. **不进对话。** 只画界面、只观察事件；不往提示词里加东西，除非这就是功能本身，而且用户知情。斜杠命令会在对话里留两行，可以学蹦一蹦用 `session.append` 把它们清空。
2. **不打扰。** Claude 闲着时别弹东西；不默认自动打开面板，给设置项让用户自己开。
3. **隐私。** 要联网的，在 README 里写清楚发什么、发到哪；默认不上传，让用户主动加入。
4. **双语。** 界面文字至少中英两种，跟随系统语言（可以照搬 `plugins/hop/hooks/i18n.ts`）。

## 桌面端踩过的坑

做蹦一蹦时踩到的，写 Mod 前看一眼能省很多时间（截至 Claude Code 2.1.286、桌面端 2.19675）：

- **桌面端加载不了 `Client` 自绘区域。** 会被内容安全策略拦下（报 `did not load within 10s`）。所以在桌面端拿不到鼠标的按下和松开；终端里可以。
- **`Svg` 加了 `isInteractive` 会放进一个嵌入框。** 每次换内容整框重新加载，画面会闪。不加就是普通图片：换图不闪，但不会播 SVG 自带的动画。要动画就自己逐帧画，用 `$.state` 驱动重画；显示中的面板最多每秒 30 帧。
- **按钮快捷键收不到「按住」时的重复按键。** 输入框的 `onInput` 收得到，可以靠它判断按住和松开。系统按键重复有约 0.45 秒的起步延迟，比这更短的轻点量不出时长。
- **`$.ui.focus` 只移动面板里的焦点标记，不一定把真正的键盘焦点交过去。** 新画一个输入框，再配合 `autoFocus` 和 `$.ui.focus`，更可靠。
- **面板频繁重画时，输入框的焦点边框会闪。** 不需要动画的时候就别重画。
- **热重载会保留 `$.state`。** 改了状态的结构，要能识别旧格式，或者重置。
- **JSX 会编译成全局的 `h(...)`。** 别用 `h` 做变量名，否则面板直接画不出来。
- **`$` 不能传给函数，也不能存进变量**，validate 会拒绝。多处要用的逻辑，写成 `session.start` 里的闭包。
- **斜杠命令默认等当前这轮结束才执行。** Claude 干活时也要能用的命令，注册时加 `immediate: true`。
- **桌面端按钮会自己显示快捷键。** 按钮文字里别再写「(R)」。
- **测试的写法。** 测试里的 `on(...)` 要在第一次调用 `$` 之前注册。用 `mock.clock`、`mock.store` 模拟时间和存储。

---

## English summary

- This repo is a Claude Code plugin marketplace; each mod lives in `plugins/<name>/`.
- **Develop:** `claude --plugin-dir plugins/<mod>` (terminal, hot reload), or set `CLAUDE_CODE_PLUGIN_DIRS` plus `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` in `~/.claude/settings.json` for the desktop app. `/plugin-authoring` lets Claude write mods with you.
- **Before a PR:** `claude plugin validate .`, `claude plugin validate plugins/<mod>`, `claude plugin test`, and `node scripts/check-facts.mjs`. CI runs the same checks.
- **Add trivia cards:** append to `plugins/hop/data/facts.json`. Prefix the id with your GitHub name. A source is required, and cards must be useful or fun.
- **New mod:** copy `templates/starter-mod`, register it in `.claude-plugin/marketplace.json`, and add a README and at least one test.
- **Mod rules:**
  - Stay out of the conversation.
  - Don't interrupt while Claude is idle.
  - Be explicit about any network use; collection is opt-in.
  - Ship zh and en.
- See "桌面端踩过的坑" above for desktop pitfalls. In short:
  - `Client` regions don't load on desktop.
  - Interactive `Svg` flickers; image `Svg` doesn't animate.
  - Button hotkeys miss key repeats, but `Input` gets them.
  - Hot reload keeps `$.state`.
  - Never name a variable `h`.
  - Add `immediate: true` to commands that should run mid-turn.
