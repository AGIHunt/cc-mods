# 蹦一蹦 / Hop

等 Claude 干活时玩的跳一跳。Claude 一轮跑了 5 秒还没完，输入框上方会出现「蹦一蹦」；也可以随时输入 `/hop`。在面板下方的框里按住空格蓄力，松开起跳。

- 每块方块带一张 AI 编程知识卡片（Claude Code、Codex、DSH、Cursor 等），没看过的优先出现
- 难度随跳数渐进，第 45 跳左右到顶
- 音效（macOS 自带 `afplay` 播放），中英双语跟随系统语言
- 可选加入 [AGI Hunt](https://agihunt.info) 排行榜：只上传昵称和成绩，随时退出并删除

**不进对话：** 面板、提示、卡片都只画在界面上；`/hop` 留在对话里的两行会被清空成「(no content)」。
**联网：** 只有加入排行榜后才会请求 `https://agihunt.info/agent/v1/hop`（上报成绩、拉榜单、退出删除）。
**需要：** Claude Code 2.1.287+ 桌面端（游戏画面用桌面端的 SVG 绘制；终端里不显示）。

## 设置

`/plugin` 里可改：要不要提示（默认开）、几秒后提示（默认 5）、到点直接打开面板（默认关）。

## 代码地图

| 文件 | 做什么 |
|---|---|
| `hooks/register.tsx` | 所有钩子：出现时机、按键判断、逐帧重画、音效、排行榜请求、面板布局 |
| `hooks/game.ts` | 纯游戏逻辑：生成方块、起跳计算、计分、难度曲线（不碰界面，好单测） |
| `hooks/scene.ts` | 把局面画成一帧静态 SVG：方块、小人、动画、卡片、结算 |
| `hooks/facts.ts` | 知识卡片的加载和「没看过的优先」排队 |
| `hooks/i18n.ts` | 中英文案；加语言就在这里加一套 |
| `data/facts.json` | 知识卡片（带出处），格式见仓库 CONTRIBUTING |
| `sounds/*.wav` | 音效，由仓库里的 `scripts/make_sounds.py` 合成，可以改参数重做 |
| `tests/` | `claude plugin test` 跑的测试 |

## 常改的地方

- **手感 / 难度：** `game.ts` 顶部的 `SPEED`（按 1 毫秒跳多远）、`MAX_HOLD_MS`，和 `nextBlock` 里的难度曲线。
- **新方块种类：** `game.ts` 的 `SPECIAL`（加分），`scene.ts` 的 `KIND_COLOR` 和 `decal`（长相）。
- **动画节奏：** `scene.ts` 里的 `FLY`、`PAN`、`DROP`、`POP` 等时长。
- **出现时机：** `register.tsx` 里的 `turn.start`、`classic.Notification`、`turn.complete` 钩子。

---

A hop game to play while Claude works. A hint appears above the prompt once a turn runs for 5 seconds; `/hop` opens it any time. Hold Space in the box under the game to charge, release to jump. Every block carries a Claude Code / AI coding tip. Optional leaderboard on agihunt.info (nickname and scores only; leave any time). Nothing is written into the conversation. Requires the Claude Code desktop app (2.1.287+).
