import type { Block, Game, Jump } from '../types'
import { factById } from './facts'
import { MAX_HOLD_MS, PRESS_MIN } from './game'
import { lang, tr } from './i18n'

// 画面：等距视角
export const W = 440
export const H = 360
// 世界整体放大多少
const ZOOM = 1.3
const FONT = `-apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif`

type Pt = [number, number]

// 地面坐标 → 屏幕坐标：+gx 往右上，+gy 往左上
function P(gx: number, gy: number, z = 0): Pt {
  return [(gx - gy) * 0.866, -(gx + gy) * 0.5 - z]
}

function cam(game: Game): Pt {
  const a = game.blocks[game.cur]
  const b = game.blocks[game.cur + 1] ?? a
  const [x1, y1] = P(a.gx, a.gy, a.height)
  const [x2, y2] = P(b.gx, b.gy, b.height)
  return [W / 2 - (ZOOM * (x1 + x2)) / 2, H * 0.6 - (ZOOM * (y1 + y2)) / 2]
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)))
  const r = f(n >> 16)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function cube(b: Block, color: string): string {
  const { gx: x, gy: y, half: w, height: h } = b
  const A0 = P(x - w, y - w), B0 = P(x + w, y - w), D0 = P(x - w, y + w)
  const A = P(x - w, y - w, h), B = P(x + w, y - w, h), C = P(x + w, y + w, h), D = P(x - w, y + w, h)
  return `<polygon points="${pts([A, B, B0, A0])}" fill="${shade(color, 0.72)}"/>
    <polygon points="${pts([A, D, D0, A0])}" fill="${shade(color, 0.86)}"/>
    <polygon points="${pts([A, B, C, D])}" fill="${color}"/>
    <polyline points="${pts([D, A, B])}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/>`
}

function disk(b: Block, color: string): string {
  const [cx, cy] = P(b.gx, b.gy, b.height)
  const rx = b.half * 1.2247
  const ry = b.half * 0.7071
  const h = b.height
  return `<path d="M${cx - rx} ${cy} L${cx - rx} ${cy + h} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + h} L${cx + rx} ${cy} Z" fill="${shade(color, 0.78)}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#fff" stroke-opacity="0.35"/>`
}

// 方块顶面上的小图案
function decal(b: Block): string {
  const [cx, cy] = P(b.gx, b.gy, b.height)
  const s = b.half / 26
  const at = (body: string) =>
    `<g transform="translate(${cx} ${cy}) scale(${s.toFixed(2)} ${(s * 0.62).toFixed(2)})">${body}</g>`
  switch (b.kind) {
    case 'terminal':
      return at(`<text x="-13" y="6" font-family="Menlo, monospace" font-size="17" font-weight="700" fill="#7CFC9A">&gt;_</text>`)
    case 'test':
      return at(`<path d="M-9 0 l6 6 l12 -13" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
    case 'git':
      return at(`<g stroke="#fff" stroke-width="3" fill="none"><circle cx="-6" cy="8" r="3.5"/><circle cx="-6" cy="-9" r="3.5"/><circle cx="8" cy="-4" r="3.5"/><path d="M-6 4.5 v-10 M-6 4 q0 -8 14 -8"/></g>`)
    case 'coffee':
      // 杯口一缕热气：短、淡，只在杯口上方
      return `<path d="M${cx} ${cy - 3} q-3 -4 0 -8 q3 -4 0 -8" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6" stroke-linecap="round"/>`
    default:
      return ''
  }
}

// 带冷知识的方块顶面印一个小二维码：三个角是定位块，中间的点由冷知识 id 决定
function qrBits(id: string): boolean[] {
  let h = 2166136261
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const bits: boolean[] = []
  for (let i = 0; i < 49; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    bits.push(((h >>> 7) & 1) === 1)
  }
  return bits
}

const isFinder = (r: number, c: number) =>
  (r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3)

function qrCell(r: number, c: number, bits: boolean[]): boolean {
  if (isFinder(r, c)) return true
  if (r === 3 || c === 3) return bits[r * 7 + c] && (r + c) % 2 === 0
  return bits[r * 7 + c]
}

function qr(b: Block, color: string): string {
  if (typeof b.fact !== 'string' || !b.fact) return ''
  const bits = qrBits(b.fact)
  const span = b.half * (b.kind === 'cube' ? 1.05 : 0.95)
  const cell = span / 7
  const x0 = b.gx - span / 2
  const y0 = b.gy - span / 2
  const z = b.height + 0.2
  let out = ''
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (!qrCell(r, c, bits)) continue
      const gx = x0 + c * cell
      const gy = y0 + r * cell
      out += `<polygon points="${pts([P(gx, gy, z), P(gx + cell, gy, z), P(gx + cell, gy + cell, z), P(gx, gy + cell, z)])}"/>`
    }
  }
  return `<g fill="${shade(color, 0.55)}" opacity="0.5">${out}</g>`
}

const KIND_COLOR: Record<string, string> = { terminal: '#2B2D31', coffee: '#7A5236', test: '#4FA35B', git: '#E8603C' }

function block(b: Block, attrs = '', anim = ''): string {
  const color = KIND_COLOR[b.kind] ?? b.color
  const isRound = b.kind === 'disk' || b.kind === 'coffee' || b.kind === 'git'
  const [sx, sy] = P(b.gx, b.gy)
  const shadow = `<ellipse cx="${sx + 10}" cy="${sy + 4}" rx="${b.half * 1.5}" ry="${b.half * 0.6}" fill="#5B4636" opacity="0.12"/>`
  const mark = b.kind === 'cube' || b.kind === 'disk' ? qr(b, color) : ''
  return `<g${attrs}>${anim}${shadow}${isRound ? disk(b, color) : cube(b, color)}${mark}${decal(b)}</g>`
}


// 画面一律是不带动画的静态图：桌面端把它当普通图片显示，换内容时不会闪。
// 动画由插件按时间一帧一帧算出来（每秒约 30 帧）。

// 主角：一只橙色的小方块怪，原点在脚底中心。pose 控制小动作
type Pose = { blink: number; armL: number; armR: number; look: number }
const REST: Pose = { blink: 0, armL: 0, armR: 0, look: 0 }

function heroArt(p: Pose): string {
  const eyeH = Math.max(0.7, 5 * (1 - p.blink))
  const eyeY = -19 + (5 - eyeH) / 2
  return `
  <rect x="-9" y="-6" width="3" height="6" fill="#B85C3E"/><rect x="-3" y="-6" width="3" height="6" fill="#B85C3E"/>
  <rect x="2" y="-6" width="3" height="6" fill="#B85C3E"/><rect x="7" y="-6" width="3" height="6" fill="#B85C3E"/>
  <rect x="-13" y="${f1(-17 - p.armL)}" width="4" height="5" fill="#D97757"/><rect x="10" y="${f1(-17 - p.armR)}" width="4" height="5" fill="#D97757"/>
  <rect x="-10" y="-24" width="21" height="18" rx="2" fill="#D97757"/>
  <rect x="${f1(-5 + p.look)}" y="${f1(eyeY)}" width="3" height="${f1(eyeH)}" fill="#2B2B2B"/><rect x="${f1(4 + p.look)}" y="${f1(eyeY)}" width="3" height="${f1(eyeH)}" fill="#2B2B2B"/>`
}

// 待机小动作：呼吸、每隔几秒眨一下眼、偶尔挥挥手、眼睛看向下一块
function idlePose(ms: number, look: number): { pose: Pose; breathe: number } {
  const blinkT = ms % BLINK_EVERY
  const blink = blinkT < 140 ? Math.sin((blinkT / 140) * Math.PI) : 0
  const waveT = ms % WAVE_EVERY
  const wave = waveT < 1000 ? Math.abs(Math.sin((waveT / 1000) * Math.PI * 3)) * 5 * Math.sin((waveT / 1000) * Math.PI) : 0
  return { pose: { blink, armL: 0, armR: wave, look }, breathe: 0 }
}

// 待机时只有眨眼、挥手那一下需要重画；其余时间画面不动，面板也就不用重画
const BLINK_EVERY = 3400
const WAVE_EVERY = 7300
export function idleMoving(ms: number): boolean {
  return ms % BLINK_EVERY < 140 + 60 || ms % WAVE_EVERY < 1000 + 60
}

const BACKGROUND = `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FBF3E7"/><stop offset="1" stop-color="#EBDDCB"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <g fill="#fff" opacity="0.5">
    <circle cx="60" cy="70" r="2"/><circle cx="380" cy="50" r="1.6"/><circle cx="330" cy="120" r="1.2"/><circle cx="110" cy="150" r="1.4"/>
  </g>`

// 起跳各段的时长（秒）
const FLY = 0.45
const PAN_AT = FLY + 0.08
const PAN = 0.35
const DROP_AT = FLY + 0.2
const DROP = 0.3
const POP = 1.0
// 新卡片等加分飘字散了再淡入
const CARD_AT = FLY + POP - 0.15
const CARD_FADE = 0.25
// 一跳从松手到画面完全停下要多久（毫秒）
export const ANIM_MS = Math.round((Math.max(PAN_AT + PAN, DROP_AT + DROP, FLY + POP, CARD_AT + CARD_FADE) + 0.05) * 1000)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)
const f1 = (v: number) => v.toFixed(1)

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const c = [16, 8, 0].map(sh => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, k)))
  return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`
}

// 黄 → 橙 → 红
const heat = (k: number) => (k < 0.5 ? mix('#E9C46A', '#F4A261', k * 2) : mix('#F4A261', '#E63946', (k - 0.5) * 2))

function hud(game: Game): string {
  return `<g font-family="${FONT}">
      <text x="22" y="52" font-size="40" font-weight="800" fill="#3D2E22">${game.score}</text>
      <text x="24" y="74" font-size="12" fill="#8C7A6B">${tr().best(game.best)}</text>
    </g>`
}

function hint(text: string): string {
  return `<text x="${W / 2}" y="${H - 18}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#8C7A6B">${text}</text>`
}

function overScreen(game: Game, alpha: number): string {
  if (alpha <= 0) return ''
  return `<g opacity="${alpha.toFixed(2)}" font-family="${FONT}" text-anchor="middle">
      <rect width="${W}" height="${H}" fill="#2B2018" opacity="0.55"/>
      ${game.lostBy === 'stay' ? '' : `<text x="${W / 2}" y="${H / 2 - 30}" font-size="15" fill="#F2E8CF">${tr().fell}</text>`}
      <text x="${W / 2}" y="${H / 2 + 20}" font-size="56" font-weight="800" fill="#fff">${game.score}</text>
      <text x="${W / 2}" y="${H / 2 + 48}" font-size="13" fill="#F2E8CF">${game.score >= game.best && game.score > 0 ? tr().record : tr().best(game.best)}</text>
    </g>`
}

// 方块竖向压缩：以底面中心为原点，sy 是高度比例
function squashed(b: Block, sy: number, extra = ''): string {
  if (Math.abs(sy - 1) < 0.001 && !extra) return block(b)
  const [bx, by] = P(b.gx, b.gy)
  return `<g${extra} transform="translate(${f1(bx)} ${f1(by)}) scale(1 ${sy.toFixed(3)}) translate(${f1(-bx)} ${f1(-by)})">${block(b)}</g>`
}

// 主角：站在 (x, y)，scale 压扁，rot 空翻角度，alpha 透明度
function hero(x: number, y: number, sx = 1, sy = 1, rot = 0, alpha = 1, pivotY = -12, pose: Pose = REST): string {
  const shadow = rot === 0 ? `<ellipse cx="0" cy="1" rx="11" ry="4" fill="#000" opacity="0.18"/>` : ''
  return `<g transform="translate(${f1(x)} ${f1(y)})" opacity="${alpha.toFixed(2)}">${shadow}<g transform="rotate(${f1(rot)} 0 ${pivotY}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})">${heroArt(pose)}</g></g>`
}

// 摔在地上：落点处躺倒，dir 决定往哪边倒
function fallen(gx: number, gy: number, dir: 'x' | 'y', k = 1): string {
  const [x, y] = P(gx, gy, 0)
  return hero(x, y, 1, 1, (dir === 'x' ? 90 : -90) * k, 1, 0, { blink: 1, armL: 0, armR: 0, look: 0 })
}

// 按地面深度把主角插进方块之间：比它远的先画，比它近的后画，近处的方块会挡住它
function layered(blocks: Block[], depth: number, me: string, draw: (b: Block) => string = b => block(b)): string {
  const sorted = byDepth(blocks)
  return `${sorted.filter(b => b.gx + b.gy >= depth).map(draw).join('')}${me}${sorted.filter(b => b.gx + b.gy < depth).map(draw).join('')}`
}

function frame(camera: Pt, world: string, over: string, tag: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><!--${tag}-->
    ${BACKGROUND}
    <g transform="translate(${f1(camera[0])} ${f1(camera[1])}) scale(${ZOOM})">${world}</g>
    ${over}
  </svg>`
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 按显示宽度折行（中文一个字算 2，英文和数字算 1）：
// 英文单词、数字、版本号、命令这类连续的半角串不拆开；逗号句号、右引号右括号不放行首；左引号左括号不留行尾
const NO_START = new Set([...'。，、；：！？）」』》〉】.,;:!?)'])
const NO_END = new Set([...'（「『《〈【('])
const widthOf = (t: string) => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)

export function wrap(text: string, max: number): string[] {
  const tokens = text.match(/[A-Za-z0-9_.+#/@:'%$~=-]+|\s+|./gsu) ?? []
  const lines: string[] = []
  let line = ''
  let w = 0
  const flush = () => {
    if (line.trim()) lines.push(line.trim())
    line = ''
    w = 0
  }
  for (const tok of tokens) {
    const tw = widthOf(tok)
    if (/^\s+$/.test(tok)) {
      if (w > 0 && w + 1 <= max) {
        line += ' '
        w += 1
      }
      continue
    }
    if (w + tw > max && line.trim()) {
      // 标点不放行首：挂在上一行末尾，宁可略微超出
      if (NO_START.has(tok)) {
        line += tok
        w += tw
        continue
      }
      // 左引号、左括号不留在行尾：带到下一行
      const last = [...line].pop() ?? ''
      if (NO_END.has(last)) {
        line = line.slice(0, -last.length)
        flush()
        line = last
        w = widthOf(last)
      } else {
        flush()
      }
    }
    // 单个半角串比一整行还长（很长的路径、网址），只好硬切
    if (tw > max) {
      let rest = tok
      while (widthOf(rest) > max - w) {
        const cut = Math.max(1, max - w)
        line += rest.slice(0, cut)
        rest = rest.slice(cut)
        flush()
      }
      line += rest
      w += widthOf(rest)
      continue
    }
    line += tok
    w += tw
  }
  flush()
  return lines
}

const CARD_W = 200

// 卡片放在下一块的反方向那一侧，避免挡住要跳的地方；anchor 是方块顶面中心的屏幕坐标
function factCard(id: string | null, anchor: Pt, side: 'left' | 'right', alpha: number): string {
  const f = factById(id)
  if (!f || alpha <= 0) return ''
  const l = lang()
  const lines = wrap(f[l], 29).slice(0, 6)
  const h = 40 + lines.length * 17
  const x = side === 'left' ? 12 : W - CARD_W - 12
  const y = side === 'left' ? 88 : 14
  const ex = side === 'left' ? x + CARD_W : x
  const ey = y + h - 12
  const bits = qrBits(f.id)
  let icon = ''
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (qrCell(r, c, bits)) icon += `<rect x="${x + 12 + c * 2}" y="${y + 11 + r * 2}" width="2" height="2"/>`
  return `<g opacity="${alpha.toFixed(2)}" font-family="${FONT}">
      <line x1="${f1(ex)}" y1="${f1(ey)}" x2="${f1(anchor[0])}" y2="${f1(anchor[1])}" stroke="#D97757" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.7"/>
      <circle cx="${f1(anchor[0])}" cy="${f1(anchor[1])}" r="3" fill="#D97757"/>
      <rect x="${x + 1}" y="${y + 2}" width="${CARD_W}" height="${h}" rx="10" fill="#5B4636" opacity="0.10"/>
      <rect x="${x}" y="${y}" width="${CARD_W}" height="${h}" rx="10" fill="#FFFDF8" stroke="#EADBC8"/>
      <g fill="#D97757">${icon}</g>
      <text x="${x + 32}" y="${y + 23}" font-size="11.5" font-weight="700" fill="#D97757">${esc(f.tag[l])}${f.surface && f.surface !== 'all' && tr().surface[f.surface] ? `<tspan fill="#8C7A6B" font-weight="400"> · ${esc(tr().surface[f.surface])}</tspan>` : ''}</text>
      ${lines.map((t, i) => `<text x="${x + 12}" y="${y + 44 + i * 17}" font-size="12" fill="#3D2E22">${esc(t)}</text>`).join('')}
    </g>`
}

// 方块顶面中心在画面上的位置（含镜头）
function topOnScreen(b: Block, camera: Pt): Pt {
  const [x, y] = P(b.gx, b.gy, b.height)
  return [camera[0] + x * ZOOM, camera[1] + y * ZOOM]
}

const sideFor = (game: Game): 'left' | 'right' => ((game.blocks[game.cur + 1] ?? game.blocks[game.cur]).dir === 'x' ? 'left' : 'right')

const byDepth = (blocks: Block[]) => [...blocks].sort((a, b) => b.gx + b.gy - (a.gx + a.gy))

// 静止：小人站在实际落点；掉下去了就盖上结算
export function stillFrame(game: Game, ms = 0): string {
  const cur = game.blocks[game.cur]
  const pos = game.at ?? { gx: cur.gx, gy: cur.gy }
  const target = game.blocks[game.cur + 1] ?? cur
  const camera = cam(game)
  let world: string
  if (game.lostBy === 'fall') {
    world = layered(game.blocks, pos.gx + pos.gy, fallen(pos.gx, pos.gy, target.dir))
  } else {
    const [hx, hy] = P(pos.gx, pos.gy, cur.height)
    const { pose, breathe } = idlePose(ms, target.dir === 'x' ? 1.2 : -1.2)
    world = layered(game.blocks, cur.gx + cur.gy, hero(hx, hy, 1 - breathe * 0.5, 1 + breathe, 0, 1, -12, pose))
  }
  const tip = game.isOver ? '' : game.jumps === 0 ? hint(tr().sceneHint) : ''
  const card = game.isOver ? '' : factCard(cur.fact, topOnScreen(cur, camera), sideFor(game), 1)
  return frame(camera, world, `${hud(game)}${card}${tip}${overScreen(game, game.isOver ? 1 : 0)}`, `still ${game.jumps}`)
}

// 蓄力：脚下的方块被压下去，小人跟着下沉、稍微扁一点，脚下一圈蓄力环，底部蓄力条
export function chargeFrame(game: Game, heldMs: number): string {
  const k = clamp01(heldMs / MAX_HOLD_MS)
  const cur = game.blocks[game.cur]
  const pos = game.at ?? { gx: cur.gx, gy: cur.gy }
  const sink = cur.height * (1 - PRESS_MIN) * k
  const [hx, hy] = P(pos.gx, pos.gy, cur.height - sink)
  const sorted = byDepth(game.blocks)
  const far = sorted.filter(b => b.gx + b.gy >= cur.gx + cur.gy)
  const near = sorted.filter(b => b.gx + b.gy < cur.gx + cur.gy)
  const color = heat(k)
  const ring = `<ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(lerp(8, cur.half * 1.2, k))}" ry="${f1(lerp(4, cur.half * 0.7, k))}" fill="none" stroke="${color}" stroke-width="2.5"/>`
  const shake = Math.sin(heldMs / 35) * 0.8 * k
  const pose: Pose = { blink: k > 0.6 ? 0.55 : 0, armL: -1 + shake, armR: -1 - shake, look: 0 }
  const world = `${far.map(b => (b === cur ? squashed(b, 1 - (1 - PRESS_MIN) * k) : block(b))).join('')}${ring}${hero(hx, hy, 1 + 0.1 * k, 1 - 0.18 * k, 0, 1, -12, pose)}${near.map(b => block(b)).join('')}`
  const bw = W - 140
  const bar = `<rect x="70" y="${H - 30}" width="${bw}" height="10" rx="5" fill="#000" opacity="0.08"/>
    <rect x="70" y="${H - 30}" width="${f1(bw * k)}" height="10" rx="5" fill="${color}"/>`
  const camera = cam(game)
  const card = factCard(cur.fact, topOnScreen(cur, camera), sideFor(game), 1)
  return frame(camera, world, `${hud(game)}${card}${bar}`, `charge ${game.jumps}`)
}

// 起跳：抛物线 + 空翻 → 落地回弹 / 加分飘字 / 完美波纹 → 镜头跟过去、新方块落下；掉下去就往下掉再盖结算
export function jumpFrame(before: Game, after: Game, j: Jump, ms: number, clockMs = 0): string {
  const t = ms / 1000
  const from = before.blocks[before.cur]
  const target = before.blocks[before.cur + 1]
  const isLand = j.result === 'land'
  const pan = isLand ? easeInOut(clamp01((t - PAN_AT) / PAN)) : 0
  const [ax, ay] = cam(before)
  const [bx, by] = isLand ? cam(after) : [ax, ay]
  const camera: Pt = [lerp(ax, bx, pan), lerp(ay, by, pan)]

  // 原来那块弹回去
  const c = 1 - (1 - PRESS_MIN) * clamp01(j.holdMs / MAX_HOLD_MS)
  const sp = clamp01(t / 0.3)
  const springY = sp < 0.4 ? lerp(c, 1.08, sp / 0.4) : sp < 0.7 ? lerp(1.08, 0.97, (sp - 0.4) / 0.3) : lerp(0.97, 1, (sp - 0.7) / 0.3)

  // 小人位置
  const [sx, sy] = P(j.from.gx, j.from.gy, j.from.z)
  const endZ = j.result === 'fall' ? target.height : j.landZ
  const [ex, ey] = P(j.to.gx, j.to.gy, endZ)
  const peak = 46 + Math.hypot(ex - sx, ey - sy) * 0.35
  const cx = (sx + ex) / 2
  const cy = Math.min(sy, ey) - peak
  const u = easeInOut(clamp01(t / FLY))
  let hx = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * cx + u * u * ex
  let hy = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * ey
  const rot = t < FLY ? (j.dir === 'x' ? 360 : -360) * u : 0
  let hsx = 1
  let hsy = 1
  const after1 = t - FLY
  if (after1 > 0 && (isLand || j.result === 'stay')) {
    const q = clamp01(after1 / 0.3)
    hsx = q < 0.35 ? lerp(1, 1.25, q / 0.35) : q < 0.7 ? lerp(1.25, 0.95, (q - 0.35) / 0.35) : lerp(0.95, 1, (q - 0.7) / 0.3)
    hsy = q < 0.35 ? lerp(1, 0.7, q / 0.35) : q < 0.7 ? lerp(0.7, 1.08, (q - 0.35) / 0.35) : lerp(1.08, 1, (q - 0.7) / 0.3)
  }
  // 掉下去：从落点直直掉到地面（越掉越快），然后往前翻倒
  const isFall = j.result === 'fall'
  let lying = 0
  if (after1 > 0 && isFall) {
    const q = clamp01(after1 / 0.3)
    const [, groundY] = P(j.to.gx, j.to.gy, 0)
    hy = lerp(ey, groundY, q * q)
    lying = easeOut(clamp01((after1 - 0.3) / 0.2))
  }

  // 新方块从上面落下来
  const spawned = isLand ? after.blocks[after.blocks.length - 1] : null
  const dq = clamp01((t - DROP_AT) / DROP)
  const drop =
    spawned && dq > 0
      ? `<g opacity="${dq.toFixed(2)}" transform="translate(0 ${f1(-50 * (1 - easeOut(dq)))})">${block(spawned)}</g>`
      : ''

  const draw = (b: Block) => (b === from ? squashed(b, springY) : block(b))
  // 空中时主角画在最上面；落地 / 掉落后按地面深度插进方块之间，近处的方块会挡住它
  const depth =
    isFall && after1 > 0 ? j.to.gx + j.to.gy : after1 > 0 ? (isLand ? target : from).gx + (isLand ? target : from).gy : Infinity
  const me =
    isFall && lying > 0
      ? fallen(j.to.gx, j.to.gy, j.dir, lying)
      : hero(hx, hy, hsx, hsy, rot, 1, -12, t < FLY ? { blink: 0, armL: 5, armR: 5, look: 0 } : idlePose(clockMs, sideFor(after) === 'left' ? 1.2 : -1.2).pose)
  const actors = depth === Infinity ? `${byDepth(before.blocks).map(draw).join('')}${me}` : layered(before.blocks, depth, me, draw)

  // 完美波纹画在方块表面（世界坐标）；加分飘字画在最上层（屏幕坐标），不会被卡片挡住
  let fx = ''
  let pop = ''
  if (isLand && after1 > 0 && after1 < POP) {
    const p = after1 / POP
    const a = p < 0.1 ? p / 0.1 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1
    const rise = 26 * p
    const px = camera[0] + ex * ZOOM
    const py = camera[1] + (ey - rise) * ZOOM
    pop = `<g font-family="${FONT}" font-weight="800" text-anchor="middle" opacity="${a.toFixed(2)}">
      <text x="${f1(px)}" y="${f1(py - 44)}" font-size="${j.isPerfect ? 26 : 21}" fill="${j.isPerfect ? '#E76F51' : '#6B5444'}" stroke="#FFFDF8" stroke-width="3" paint-order="stroke">+${j.gained}</text>
      ${j.label ? `<text x="${f1(px)}" y="${f1(py - 70)}" font-size="14" fill="#6B5444" stroke="#FFFDF8" stroke-width="3" paint-order="stroke">${esc(j.label)}</text>` : ''}
    </g>`
    if (j.isPerfect && after1 < 0.6) {
      const r = after1 / 0.6
      fx += `<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="${f1(lerp(4, target.half * 2, r))}" ry="${f1(lerp(2, target.half * 1.15, r))}" fill="none" stroke="#fff" stroke-width="3" opacity="${(0.9 * (1 - r)).toFixed(2)}"/>`
    }
  }

  const world = `${drop}${actors}${fx}`
  const overAlpha = after.isOver ? clamp01((t - (FLY + 0.5)) / 0.3) : 0
  const oldCard = factCard(from.fact, topOnScreen(from, camera), sideFor(before), 1 - clamp01(t / 0.15))
  const newCard = isLand ? factCard(target.fact, topOnScreen(target, camera), sideFor(after), clamp01((t - CARD_AT) / CARD_FADE)) : ''
  return frame(camera, world, `${hud(isLand && after1 > 0 ? after : before)}${oldCard}${newCard}${pop}${overScreen(after, overAlpha)}`, `jump ${j.n}`)
}
