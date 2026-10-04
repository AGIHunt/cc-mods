// 方块上的冷知识卡片：落到哪块，下面就显示哪块的那一条。循环使用，跨局接着往下轮。
// 初稿 12 条，待作者 review 后再扩到 200 条左右。

export type Fact = { tag: string; text: string }

export const FACTS: Fact[] = [
  { tag: '快捷键', text: '连按两下 Esc，可以回到之前的任意一条消息，改一改再重来。' },
  { tag: '快捷键', text: 'Shift+Tab 在几种权限模式之间切换：默认、自动接受编辑、计划模式（只想不改）。' },
  { tag: '记忆', text: 'CLAUDE.md 是项目的「长期记忆」，每次启动都会读。不知道怎么写？在项目里跑一下 /init，让它自己生成一份。' },
  { tag: '小技巧', text: '输入框里以 ! 开头，直接跑一条 shell 命令，命令和输出都会进到对话里，Claude 能看到。' },
  { tag: '小技巧', text: '输入 @ 加文件路径，可以把文件直接带进对话，不用让 Claude 再去找。' },
  { tag: '命令行', text: 'claude -p "问题" 是无头模式：不进交互界面，答完就退出，适合塞进脚本和 CI。' },
  { tag: '命令行', text: 'claude -c 接着上一次的会话聊；claude --resume 可以从历史会话里挑一个继续。' },
  { tag: '上下文', text: '/compact 会把前面的对话压缩成摘要，腾出上下文。后面可以跟一句话，告诉它重点保留什么。' },
  { tag: '子 agent', text: '子 agent 有自己独立的上下文窗口。派它去翻代码、查资料，翻过的几十个文件不会塞满主对话。' },
  { tag: 'Hooks', text: 'Hooks 能在固定时机自动跑命令，比如每次改完文件就跑一遍格式化，不用每次提醒 Claude。' },
  { tag: 'Skills', text: '一个 Skill 就是一个带 SKILL.md 的文件夹。平时 Claude 只看它的简介，用得上时才读全文，所以装很多也不占上下文。' },
  { tag: '历史', text: 'MCP（Model Context Protocol）是 Anthropic 在 2024 年 11 月开源的协议，让模型用统一的方式接外部工具和数据。' },
  { tag: '历史', text: 'Claude Code 最早在 2025 年 2 月和 Claude 3.7 Sonnet 一起，以「研究预览」的身份发布。' },
  { tag: 'Mods', text: '你正在玩的蹦一蹦就是一个 Mod：几百行 TypeScript，挂在 Claude Code 的事件上，自己画面板、自己算动画。' },
]
