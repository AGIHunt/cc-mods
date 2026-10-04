import type { Block, BlockKind, Game, Jump } from '../types'
import { tr } from './i18n'

// 按住 1 毫秒能跳多远（地面单位）
export const SPEED = 0.09
// 最多蓄力这么久
export const MAX_HOLD_MS = 2600
// 按住时方块最多压到原高度的这么多
export const PRESS_MIN = 0.62

const PLAIN: string[] = ['#E9C46A', '#F4A261', '#8AB17D', '#7FB3D5', '#C9ADA7', '#F2E8CF', '#B8A1D9', '#E5989B']

// 特殊方块：落上去有额外加分
export const SPECIAL: Record<Exclude<BlockKind, 'cube' | 'disk'>, { bonus: number }> = {
  terminal: { bonus: 3 },
  coffee: { bonus: 3 },
  test: { bonus: 5 },
  git: { bonus: 5 },
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
  // 难度按跳了几块来算（不按分数，连击加分太快会让难度跳着涨）：
  // 前 3 跳是热身大块；之后到第 45 跳左右，方块从 27 缩到 13、间距越拉越大；
  // 过了一半，偶尔冒出特别小的块（半径 10），跳中允许的按键误差约 ±0.1 秒
  const level = Math.min(game.jumps, 45) / 45
  const isWarmup = game.jumps < 3
  const isTiny = !isWarmup && level > 0.5 && roll() < 0.12 + 0.1 * level
  const half = isWarmup
    ? 29 + roll() * 3
    : isTiny
      ? 10 + roll() * 1.5
      : Math.max(11, 27 - level * 14 + (roll() - 0.5) * 7)
  const gap = isWarmup ? 8 + roll() * 10 : 10 + roll() * (20 + level * 60)
  const dir = roll() < 0.5 ? 'x' : 'y'
  const dist = from.half + half + gap
  const special = roll()
  let kind: BlockKind = roll() < 0.5 ? 'cube' : 'disk'
  if (game.jumps > 1 && special < 0.14) {
    kind = (['terminal', 'coffee', 'test', 'git'] as const)[Math.floor(roll() * 4)]
  }
  const color = PLAIN[Math.floor(roll() * PLAIN.length)]
  game.seed = seed
  const fact = game.factQueue.shift() ?? null
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

export function newGame(seed: number, best: number, factQueue: string[] = []): Game {
  const first: Block = { gx: 0, gy: 0, half: 28, height: 26, kind: 'cube', color: '#F2E8CF', dir: 'x', fact: null }
  const game: Game = { blocks: [first], cur: 0, score: 0, combo: 0, best, seed, isOver: false, jumps: 0, at: null, lostBy: null, factQueue: [...factQueue], perfects: 0 }
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
    if (isPerfect) game.perfects += 1
    let gained = isPerfect ? 2 * game.combo : 1
    const t = tr()
    let label = isPerfect ? (game.combo > 1 ? t.perfectN(game.combo) : t.perfect) : ''
    if (target.kind in SPECIAL) {
      const kind = target.kind as keyof typeof SPECIAL
      gained += SPECIAL[kind].bonus
      label = label ? `${label} · ${t[kind]}` : t[kind]
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
