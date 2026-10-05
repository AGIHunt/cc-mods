# 蹦一蹦 · DeepSeek Harness 版 / Hop for DSH

等 DeepSeek 干活时玩的跳一跳。和 Claude Code 版是同一套游戏（同一份游戏逻辑、画面和知识卡片），主角换成了小鲸鱼。

- 右侧边栏「开始」里点 **蹦一蹦** 打开；DeepSeek 一轮活干了 5 秒还没完，输入框上方也会出现提示，点一下就开玩
- 点一下画面，**按住空格（或按住鼠标）蓄力，松开起跳**
- 每块方块带一张 AI 编程知识卡片，没看过的优先出现
- 音效、中英双语（跟随系统语言）、难度随跳数渐进
- 最高分和看过的卡片存在本机浏览器存储里，不联网

## 安装

需要 DeepSeek Harness 0.2 或更新（桌面端或 `dsh web`）。

**桌面端 / Web：** 侧栏 **插件** → **添加插件**，填入下面这行，点 **安装**，再点 **立即启用**：

```
github:AGIHunt/cc-mods#path:dsh/hop
```

**命令行：**

```bash
dsh plugin --profile desktop add "github:AGIHunt/cc-mods#path:dsh/hop"
```

（`desktop` 换成你用的 profile，比如 `web`。）升级：先卸载，再按上面装一次。

## 和 Claude Code 版的区别

DSH 的 Claude Code Mods 兼容层目前只能在输入框上方画一条文字横幅，画不了游戏，所以这里用 DSH 自己的插件体系写了一个原生插件：浏览器端注册右侧边栏标签页和输入框上方的提示条，游戏逻辑和画面直接复用 `plugins/hop/hooks` 里的代码。

- 排行榜暂时只在 Claude Code 版里有
- 只显示通用的知识卡片（只对 Claude Code 某一端成立的卡片不出现）

## 开发

```bash
npm install
npm run build            # 生成 client.js（打包了 ../../plugins/hop/hooks 的游戏代码、卡片和音效）
dsh plugin --profile web add "$(pwd)"   # 装成本地链接，改完重新 build 后刷新页面
```

- `src/client.tsx`：浏览器端入口，注册侧边栏标签页、提示条，处理按键、鼠标、音效和存档
- `index.js`：Host 端，什么也不做
- `cordis.patch.yml`、`locale/*.json`、`icon.svg`：DSH 组合包的清单、插件名和图标

改了 `plugins/hop/hooks` 或卡片之后要重新 `npm run build`，并把 `client.js` 一起提交（从 GitHub 安装时不会运行构建）。

---

Hop for DeepSeek Harness: the same game as the Claude Code mod, with a whale. Install from **Plugins → Add plugin** with `github:AGIHunt/cc-mods#path:dsh/hop`, or `dsh plugin --profile desktop add "github:AGIHunt/cc-mods#path:dsh/hop"`. Open it from the right sidebar; a hint appears above the composer once DeepSeek has been working for 5 seconds. Hold Space (or the mouse) to charge, release to jump. No network access; the leaderboard is Claude Code only for now.
