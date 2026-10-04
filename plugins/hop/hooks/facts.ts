// 方块上的冷知识卡片。完整题库在 data/facts.json（启动时读入），这里的内置几条是读不到题库时的后备。
// 轮播：玩家真正「落到过」的冷知识记为看过；新开一局时从没看过的里面随机排一队，全看完才重来。

// surface：这条只在哪个端成立；all 或不写就是通用
export type Fact = { id: string; tag: { zh: string; en: string }; zh: string; en: string; surface?: string }

export const BUILTIN: Fact[] = [
  {
    id: 'base-01',
    tag: { zh: '快捷键', en: 'Shortcut' },
    zh: '连按两下 Esc，可以回到之前的任意一条消息，改一改再重来。',
    en: 'Press Esc twice to jump back to any earlier message, edit it, and try again.',
  },
  {
    id: 'base-02',
    tag: { zh: '快捷键', en: 'Shortcut' },
    zh: 'Shift+Tab 在几种权限模式之间切换：默认、自动接受编辑、计划模式（只想不改）。',
    en: 'Shift+Tab cycles permission modes: default, auto-accept edits, and plan mode (think, no edits).',
  },
  {
    id: 'base-03',
    tag: { zh: '记忆', en: 'Memory' },
    zh: 'CLAUDE.md 是项目的长期记忆，每次启动都会读。不知道怎么写？跑一下 /init 让它自己生成。',
    en: 'CLAUDE.md is the project memory, read on every start. Run /init to have Claude draft one for you.',
  },
  {
    id: 'base-04',
    tag: { zh: '小技巧', en: 'Tip' },
    zh: '输入框里以 ! 开头，直接跑一条 shell 命令，命令和输出都会进到对话里。',
    en: 'Start a prompt with ! to run a shell command; the command and its output land in the conversation.',
  },
  {
    id: 'base-05',
    tag: { zh: '小技巧', en: 'Tip' },
    zh: '输入 @ 加文件路径，把文件直接带进对话，不用让 Claude 再去找。',
    en: 'Type @ plus a file path to pull that file straight into the conversation.',
  },
  {
    id: 'base-06',
    tag: { zh: '命令行', en: 'CLI' },
    zh: 'claude -p "问题" 是无头模式：不进交互界面，答完就退出，适合塞进脚本和 CI。',
    en: 'claude -p "question" runs headless: no UI, answers and exits. Great for scripts and CI.',
  },
  {
    id: 'base-07',
    tag: { zh: '命令行', en: 'CLI' },
    zh: 'claude -c 接着上一次的会话聊；claude --resume 可以从历史会话里挑一个继续。',
    en: 'claude -c continues your last session; claude --resume lets you pick any past one.',
  },
  {
    id: 'base-08',
    tag: { zh: '上下文', en: 'Context' },
    zh: '/compact 把前面的对话压缩成摘要腾出上下文，后面可以跟一句话告诉它重点保留什么。',
    en: '/compact summarizes the conversation to free context. Add a note to say what to keep.',
  },
  {
    id: 'base-09',
    tag: { zh: '子 agent', en: 'Subagents' },
    zh: '子 agent 有独立的上下文窗口。派它去翻代码，翻过的几十个文件不会塞满主对话。',
    en: 'Subagents get their own context window, so the dozens of files they read stay out of yours.',
  },
  {
    id: 'base-10',
    tag: { zh: 'Hooks', en: 'Hooks' },
    zh: 'Hooks 能在固定时机自动跑命令，比如每次改完文件就跑格式化，不用每次提醒 Claude。',
    en: 'Hooks run commands at fixed moments, like formatting after every edit, so you never have to ask.',
  },
  {
    id: 'base-11',
    tag: { zh: 'Skills', en: 'Skills' },
    zh: 'Skill 平时只露出简介，用得上时才读全文，所以装很多也不占上下文。',
    en: 'Skills show only their description until needed, so installing many barely costs context.',
  },
  {
    id: 'base-12',
    tag: { zh: '历史', en: 'History' },
    zh: 'MCP 是 Anthropic 在 2024 年 11 月开源的协议，让模型用统一的方式接外部工具和数据。',
    en: 'Anthropic open-sourced MCP in November 2024: one standard way for models to reach tools and data.',
  },
  {
    id: 'base-13',
    tag: { zh: '历史', en: 'History' },
    zh: 'Claude Code 最早在 2025 年 2 月和 Claude 3.7 Sonnet 一起，以研究预览的身份发布。',
    en: 'Claude Code first shipped in February 2025 as a research preview alongside Claude 3.7 Sonnet.',
  },
  {
    id: 'base-14',
    tag: { zh: 'Mods', en: 'Mods' },
    zh: '你正在玩的蹦一蹦就是一个 Mod：挂在 Claude Code 的事件上，自己画面板、自己算动画。',
    en: 'This game is a Mod: it hooks into Claude Code events, draws its own pane and animates itself.',
  },
]

let all: Fact[] = BUILTIN
const byId = new Map(BUILTIN.map(f => [f.id, f]))

export function setFacts(list: Fact[]): void {
  if (list.length === 0) return
  all = list
  byId.clear()
  for (const f of list) byId.set(f.id, f)
}

export const factById = (id: string | null): Fact | null => (typeof id === 'string' ? (byId.get(id) ?? null) : null)

// 新开一局用的队列：没看过的随机排；全看过了就重新开始一轮
export function queueFor(seen: readonly string[], seed: number): string[] {
  const seenSet = new Set(seen)
  let pool = all.filter(f => !seenSet.has(f.id)).map(f => f.id)
  if (pool.length === 0) pool = all.map(f => f.id)
  let s = seed >>> 0
  for (let i = pool.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

export const factCount = (): number => all.length
