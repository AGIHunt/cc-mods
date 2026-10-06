export type BlockKind = 'cube' | 'disk' | 'terminal' | 'coffee' | 'test' | 'git'

export type Block = {
  gx: number
  gy: number
  half: number
  height: number
  kind: BlockKind
  color: string
  // 这一块是沿哪条轴从上一块延伸出来的
  dir: 'x' | 'y'
  // 这块带的冷知识（id）；起点那块没有
  fact: string | null
}

export type Game = {
  blocks: Block[]
  cur: number
  score: number
  combo: number
  best: number
  seed: number
  isOver: boolean
  jumps: number
  // 小人实际站的位置（不一定在方块正中）；null 表示在当前方块正中
  at: { gx: number; gy: number } | null
  // 怎么输的：掉下去了，还是原地踏步
  lostBy: 'fall' | 'stay' | null
  // 接下来的方块依次用哪些冷知识（新开一局时从没看过的里随机排好）
  factQueue: string[]
  // 完美落地次数（上报排行榜用）
  perfects: number
}

export type Jump = {
  n: number
  from: { gx: number; gy: number; z: number }
  to: { gx: number; gy: number }
  dir: 'x' | 'y'
  holdMs: number
  result: 'land' | 'stay' | 'fall'
  isPerfect: boolean
  gained: number
  label: string
  landZ: number
}

export type Phase = 'idle' | 'charge' | 'jump'

// 面板画面需要的一切放在一个值里：一次写入只重画一次
export type View = {
  game: Game | null
  before: Game | null
  phase: Phase
  jump: Jump | null
  // 面板下方那行提示
  hint: string
  // 输入框的代号：每跳一次换一个新的空框
  pad: number
  // 开始蓄力、起跳的时刻：每一帧按「现在离它多久」算画面
  chargeAt: number
  jumpAt: number
  // 这一局第一次按下的时刻（上报时长用）
  startedAt: number
}

export type BoardTab = 'today' | 'week' | 'all'
export type BoardEntry = { rank: number; nickname: string; score: number; isMe: boolean }

// Claude 这边在干什么：决定提示条和面板顶上那行
export type ClaudeStatus = {
  busy: boolean
  needsYou: boolean
  done: boolean
  // 输入框上方的「蹦一蹦」提示是否该出现
  hint: boolean
}

// 排行榜：自愿加入；没加入时什么都不上报
export type Board = {
  joined: boolean
  nickname: string
  tab: BoardTab
  entries: BoardEntry[]
  me: { rank: number; score: number } | null
  // 连不上、昵称不合规这类提示
  status: string
  busy: boolean
  // 加载超过 3 秒还没回来：提示网络慢，免得以为坏了
  slow: boolean
}

declare module 'claude-code' {
  interface PluginState {
    hop: {
      view: View
      // 动画帧计数：按住和起跳期间每帧加一，面板读它来逐帧重画
      tick: number
      board: Board
      claude: ClaudeStatus
    }
  }
}
