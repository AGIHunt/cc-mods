import type { Block, BlockKind, Game, Jump } from '../types'
import { FACTS } from './facts'

// 按住 1 毫秒能跳多远（地面单位）
export const SPEED = 0.09
// 最多蓄力这么久
export const MAX_HOLD_MS = 2600
// 按住时方块最多压到原高度的这么多
export const PRESS_MIN = 0.62

const PLAIN: string[] = ['#E9C46A', '#F4A261', '#8AB17D', '#7FB3D5', '#C9ADA7', '#F2E8CF', '#B8A1D9', '#E5989B']

// 特殊方块：落上去有额外加分
export const SPECIAL: Record<Exclude<BlockKind, 'cube' | 'disk'>, { bonus: number; label: string }> = {
  terminal: { bonus: 3, label: '>_ 终端 +3' },
  coffee: { bonus: 3, label: '☕ 续命 +3' },
  test: { bonus: 5, label: '✓ 测试全绿 +5' },
  git: { bonus: 5, label: '⎇ 合进 main +5' },
}

// 可复现的随机数：种子存在局面里，热重载后接着用
export function rand(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), t | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}

function nextBlock(game: Game, from: Block): Block {
  let seed = game.seed
  const roll = (): number => {
    const [v, s] = rand(seed)
    seed = s
    return v
  }
  // 越往后方块越小、间距越大
  const level = Math.min(game.score, 60) / 60
  // 开头几跳给大块、近距离，先让人找到手感
  const isWarmup = game.jumps < 3
  const half = isWarmup ? 29 + roll() * 3 : Math.max(13, 27 - level * 11 + (roll() - 0.5) * 7)
  const gap = isWarmup ? 8 + roll() * 10 : 10 + roll() * (22 + level * 46)
  const dir = roll() < 0.5 ? 'x' : 'y'
  const dist = from.half + half + gap
  const special = roll()
  let kind: BlockKind = roll() < 0.5 ? 'cube' : 'disk'
  if (game.jumps > 1 && special < 0.14) {
    kind = (['terminal', 'coffee', 'test', 'git'] as const)[Math.floor(roll() * 4)]
  }
  const color = PLAIN[Math.floor(roll() * PLAIN.length)]
  game.seed = seed
  const fact = game.factNext % FACTS.length
  game.factNext = (game.factNext + 1) % FACTS.length
  return {
    fact,
    gx: from.gx + (dir === 'x' ? dist : 0),
    gy: from.gy + (dir === 'y' ? dist : 0),
    half,
    height: 22 + Math.round(roll() * 8),
    kind,
    color,
    dir,
  }
}

export function newGame(seed: number, best: number, factStart = 0): Game {
  const first: Block = { gx: 0, gy: 0, half: 28, height: 26, kind: 'cube', color: '#F2E8CF', dir: 'x', fact: null }
  const game: Game = { blocks: [first], cur: 0, score: 0, combo: 0, best, seed, isOver: false, jumps: 0, at: null, lostBy: null, factNext: factStart }
  game.blocks.push(nextBlock(game, first))
  return game
}

// 一次起跳：算落点、结果和加分，返回新局面（不改旧的）
// 某点是否落在方块顶面上：方块按正方形算，圆柱按圆算
function onTop(b: Block, gx: number, gy: number): boolean {
  const dx = gx - b.gx
  const dy = gy - b.gy
  const isRound = b.kind === 'disk' || b.kind === 'coffee' || b.kind === 'git'
  return isRound ? Math.hypot(dx, dy) <= b.half : Math.max(Math.abs(dx), Math.abs(dy)) <= b.half
}

// 一次起跳：从小人实际站的位置，朝下一块的中心跳，按住多久就跳多远
export function jump(prev: Game, holdMs: number): { game: Game; jump: Jump } {
  const game: Game = JSON.parse(JSON.stringify(prev)) as Game
  const cur = game.blocks[game.cur]
  const target = game.blocks[game.cur + 1]
  const from = game.at ?? { gx: cur.gx, gy: cur.gy }
  const ms = Math.max(0, Math.min(MAX_HOLD_MS, holdMs))
  const dist = ms * SPEED
  const vx = target.gx - from.gx
  const vy = target.gy - from.gy
  const len = Math.hypot(vx, vy) || 1
  const land = { gx: from.gx + (vx / len) * dist, gy: from.gy + (vy / len) * dist }
  const toCenter = Math.hypot(target.gx - land.gx, target.gy - land.gy)

  const base: Omit<Jump, 'result' | 'isPerfect' | 'gained' | 'label' | 'landZ'> = {
    n: game.jumps + 1,
    from: { gx: from.gx, gy: from.gy, z: cur.height },
    to: land,
    dir: target.dir,
    holdMs: ms,
  }
  game.jumps += 1

  if (onTop(target, land.gx, land.gy)) {
    const isPerfect = toCenter <= Math.max(4, target.half * 0.25)
    game.combo = isPerfect ? game.combo + 1 : 0
    let gained = isPerfect ? 2 * game.combo : 1
    let label = isPerfect ? (game.combo > 1 ? `完美 ×${game.combo}` : '完美') : ''
    if (target.kind in SPECIAL) {
      const sp = SPECIAL[target.kind as keyof typeof SPECIAL]
      gained += sp.bonus
      label = label ? `${label} · ${sp.label}` : sp.label
    }
    game.score += gained
    game.best = Math.max(game.best, game.score)
    game.cur += 1
    game.at = land
    game.blocks.push(nextBlock(game, target))
    // 只留身后几块当风景
    if (game.cur > 4) {
      game.blocks = game.blocks.slice(game.cur - 4)
      game.cur = 4
    }
    return { game, jump: { ...base, result: 'land', isPerfect, gained, label, landZ: target.height } }
  }

  // 跳得太近，还落在原来那块上：跟跳一跳一样，原地踏步也算输
  if (onTop(cur, land.gx, land.gy)) {
    game.at = land
    game.isOver = true
    game.lostBy = 'stay'
    game.combo = 0
    return { game, jump: { ...base, result: 'stay', isPerfect: false, gained: 0, label: '', landZ: cur.height } }
  }

  game.at = land
  game.isOver = true
  game.lostBy = 'fall'
  game.combo = 0
  return { game, jump: { ...base, result: 'fall', isPerfect: false, gained: 0, label: '', landZ: 0 } }
}
