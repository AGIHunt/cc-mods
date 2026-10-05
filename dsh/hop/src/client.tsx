// 蹦一蹦的 DeepSeek Harness 版：浏览器这一半。
// 游戏逻辑和画面直接复用 Claude Code 版（plugins/hop/hooks 下的 game / scene / facts / i18n），
// 这里只负责：右侧边栏的「蹦一蹦」标签页、输入框上方的提示条、按键和鼠标、音效、本地存档。
// 主角换成小鲸鱼。
import * as React from 'react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Game, Jump } from '../../../plugins/hop/types'
import { jump, newGame, SPECIAL } from '../../../plugins/hop/hooks/game'
import { ANIM_MS, chargeFrame, jumpFrame, setCanvas, setSkin, stillFrame } from '../../../plugins/hop/hooks/scene'
import { queueFor, setFacts, type Fact } from '../../../plugins/hop/hooks/facts'
import { setLang } from '../../../plugins/hop/hooks/i18n'
import allFacts from '../../../plugins/hop/data/facts.json'
import bonus from './sounds/bonus.mp3'
import charge from './sounds/charge.mp3'
import fall from './sounds/fall.mp3'
import jumpSnd from './sounds/jump.mp3'
import land from './sounds/land.mp3'
import over from './sounds/over.mp3'
import perfect from './sounds/perfect.mp3'
import record from './sounds/record.mp3'

const ID = '@agihunt/dsh-hop'
const KIND = 'hop'
const HINT_AFTER_MS = 5000
const QUEUE = 80
const FLY_MS = 450
// 控件占的高度：画布下面一行提示、一行分数
const CONTROLS_PX = 64

const zh = (() => {
  try {
    return (navigator.language || '').toLowerCase().startsWith('zh')
  } catch {
    return true
  }
})()
setLang(zh ? 'zh' : 'en')
setSkin('whale')
// 只在 Claude Code 某一端成立的卡片（终端、桌面端……）在这里没意义，只留通用的
setFacts((allFacts as Fact[]).filter(f => !f.surface || f.surface === 'all'))

const T = zh
  ? {
      title: '蹦一蹦',
      guide: '等 DeepSeek 干活时，跳几下',
      busy: 'DeepSeek 还在干活',
      play: '蹦一蹦',
      mute: '本会话不再提示',
      done: 'DeepSeek 干完了',
      hint: '点画面，按住空格（或按住鼠标）蓄力，松开起跳',
      restart: '再来一局',
      held: (s: string) => `按了 ${s} 秒`,
      score: (a: number, b: number) => `本局 ${a} · 最高 ${b}`,
      special: '特殊方块有额外加分：终端、咖啡 +3，测试、Git +5',
      sound: '音效',
    }
  : {
      title: 'Hop',
      guide: 'A little game while DeepSeek works',
      busy: 'DeepSeek is still working',
      play: 'Play Hop',
      mute: 'Not this session',
      done: 'DeepSeek is done',
      hint: 'Click the game, hold Space (or the mouse) to charge, release to jump',
      restart: 'Play again',
      held: (s: string) => `Held ${s}s`,
      score: (a: number, b: number) => `Score ${a} · Best ${b}`,
      special: 'Special blocks give bonus points: terminal and coffee +3, test and Git +5',
      sound: 'Sound',
    }

// ---------- 本地存档（每个浏览器 / 桌面端各存一份）----------
const load = <V,>(key: string, fallback: V): V => {
  try {
    const raw = localStorage.getItem(`agihunt-hop.${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as V)
  } catch {
    return fallback
  }
}
const save = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(`agihunt-hop.${key}`, JSON.stringify(value))
  } catch {
    // 存不了就算了，不影响玩
  }
}

// ---------- 音效 ----------
const SOUNDS: Record<string, string> = { bonus, charge, fall, jump: jumpSnd, land, over, perfect, record }
let audio: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
function buffer(name: string): Promise<AudioBuffer | null> {
  let p = buffers.get(name)
  if (!p) {
    p = (async () => {
      try {
        audio ??= new AudioContext()
        const bytes = await (await fetch(SOUNDS[name])).arrayBuffer()
        return await audio.decodeAudioData(bytes)
      } catch {
        return null
      }
    })()
    buffers.set(name, p)
  }
  return p
}
function play(name: string, volume = 0.5): () => void {
  let source: AudioBufferSourceNode | null = null
  let stopped = false
  void buffer(name).then(b => {
    if (!b || !audio || stopped) return
    if (audio.state === 'suspended') void audio.resume()
    const gain = audio.createGain()
    gain.gain.value = volume
    source = audio.createBufferSource()
    source.buffer = b
    source.connect(gain).connect(audio.destination)
    source.start()
  })
  return () => {
    stopped = true
    try {
      source?.stop()
    } catch {
      // 已经停了
    }
  }
}

// ---------- 每个会话的 Agent 运行状态（提示条用）----------
type Running = { since: number | null; muted: boolean; ran: boolean }
const running = new Map<string, Running>()
const listeners = new Set<() => void>()
// 每次变化加一，组件用它判断要不要重画
let version = 0
const emit = (): void => {
  version += 1
  for (const l of listeners) l()
}
const useVersion = (): number => useSyncExternalStore(subscribe, () => version)
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const IDLE: Running = { since: null, muted: false, ran: false }
const runningOf = (id: string): Running => running.get(id) ?? IDLE
function setRunning(id: string, isRunning: boolean): void {
  const cur = runningOf(id)
  const since = isRunning ? (cur.since ?? Date.now()) : null
  if (since === cur.since) return
  running.set(id, { ...cur, since, ran: cur.ran || isRunning })
  emit()
}
let bodyShown = 0

// ---------- 游戏面板 ----------
type View = {
  game: Game
  phase: 'idle' | 'charge' | 'jump'
  chargeAt: number
  before: Game | null
  jump: Jump | null
  jumpAt: number
}

function freshGame(best: number): Game {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0
  return newGame(seed, best, queueFor(load<string[]>('seen', []), seed).slice(0, QUEUE))
}

function HopBody(props: { sessionId: string }): React.ReactNode {
  const host = useRef<HTMLDivElement>(null)
  const art = useRef<HTMLDivElement>(null)
  const view = useRef<View>({ game: freshGame(load('best', 0)), phase: 'idle', chargeAt: 0, before: null, jump: null, jumpAt: 0 })
  const chargeStop = useRef<(() => void) | null>(null)
  const [, setTick] = useState(0)
  const [hint, setHint] = useState(T.hint)
  const [muted, setMuted] = useState(load('muted', false))
  const mutedRef = useRef(muted)
  mutedRef.current = muted
  useVersion()
  const status = runningOf(props.sessionId)
  const sizeKey = useRef('')

  useEffect(() => {
    bodyShown += 1
    emit()
    return () => {
      bodyShown -= 1
      emit()
    }
  }, [])

  // 画布跟着面板大小走：宽面板看得更远，方块大小不变
  useEffect(() => {
    const el = host.current
    if (!el) return
    const fit = (): void => {
      const w = Math.max(240, Math.min(1400, el.clientWidth - 16))
      const h = Math.max(200, Math.min(w * 0.82, el.clientHeight - CONTROLS_PX - 16, 900))
      const key = `${Math.round(w)}x${Math.round(h)}`
      if (key === sizeKey.current) return
      sizeKey.current = key
      setCanvas(Math.round(w), Math.round(h))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    el.focus()
    return () => ro.disconnect()
  }, [])

  // 逐帧画：画面字符串没变就不动 DOM
  useEffect(() => {
    let raf = 0
    let last = ''
    let lastSize = ''
    const loop = (): void => {
      const now = performance.now()
      const v = view.current
      const svg =
        v.phase === 'charge'
          ? chargeFrame(v.game, now - v.chargeAt)
          : v.phase === 'jump' && v.before && v.jump && now - v.jumpAt < ANIM_MS
            ? jumpFrame(v.before, v.game, v.jump, now - v.jumpAt, now)
            : stillFrame(v.game, now)
      if (v.phase === 'jump' && now - v.jumpAt >= ANIM_MS) v.phase = 'idle'
      if ((svg !== last || sizeKey.current !== lastSize) && art.current) {
        art.current.innerHTML = svg
        last = svg
        lastSize = sizeKey.current
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const press = (): void => {
    const v = view.current
    if (v.game.isOver || v.phase === 'charge') return
    if (v.phase === 'jump' && performance.now() - v.jumpAt < ANIM_MS) return
    v.phase = 'charge'
    v.chargeAt = performance.now()
    if (!mutedRef.current) chargeStop.current = play('charge', 0.35)
  }

  const release = (): void => {
    const v = view.current
    if (v.phase !== 'charge') return
    chargeStop.current?.()
    chargeStop.current = null
    const now = performance.now()
    const held = now - v.chargeAt
    const before = v.game
    const result = jump(before, held)
    const target = before.blocks[before.cur + 1]
    view.current = { game: result.game, phase: 'jump', chargeAt: v.chargeAt, before, jump: result.jump, jumpAt: now }

    // 真的落到这块上了，它的卡片才算看过
    if (result.jump.result === 'land' && target.fact) {
      const seen = load<string[]>('seen', [])
      if (!seen.includes(target.fact)) save('seen', [...seen, target.fact])
    }
    const lastBest = load('best', 0)
    const isRecord = result.game.isOver && result.game.score > lastBest
    if (isRecord) save('best', result.game.score)
    const landedSpecial = result.jump.result === 'land' && target.kind in SPECIAL
    const explained = load('specialExplained', false)
    if (landedSpecial && !explained) save('specialExplained', true)
    setHint(landedSpecial && !explained ? T.special : T.held((held / 1000).toFixed(2)))
    setTick(t => t + 1)

    if (!mutedRef.current) {
      play('jump')
      const r = result.jump
      const landing =
        r.result === 'fall'
          ? ['fall', isRecord ? 'record' : 'over']
          : r.result === 'stay'
            ? ['land', isRecord ? 'record' : 'over']
            : ['land', ...(r.isPerfect ? ['perfect'] : []), ...(target.kind in SPECIAL ? ['bonus'] : [])]
      landing.forEach((name, i) => {
        const gap = i === 0 ? 0 : r.result === 'land' ? 90 * i : 520 * i
        setTimeout(() => play(name), FLY_MS + gap)
      })
    }
  }

  const restart = (): void => {
    view.current = { game: freshGame(Math.max(view.current.game.best, load('best', 0))), phase: 'idle', chargeAt: 0, before: null, jump: null, jumpAt: 0 }
    setHint(T.hint)
    setTick(t => t + 1)
    host.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      if (!e.repeat) press()
    } else if ((e.key === 'r' || e.key === 'R' || e.key === 'Enter') && view.current.game.isOver) {
      e.preventDefault()
      restart()
    }
  }
  const onKeyUp = (e: React.KeyboardEvent): void => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      e.stopPropagation()
      release()
    }
  }

  const game = view.current.game
  const dim = { opacity: 0.7 }
  return (
    <div
      ref={host}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={release}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8, boxSizing: 'border-box', outline: 'none', fontSize: 13, userSelect: 'none' }}
    >
      <div style={{ minHeight: 18, fontWeight: 600, color: status.since !== null ? '#4D6BFE' : '#2a9d78' }}>{status.since !== null ? T.busy : status.ran ? T.done : ''}</div>
      <div
        ref={art}
        onPointerDown={e => {
          host.current?.focus()
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          press()
        }}
        onPointerUp={release}
        onPointerCancel={release}
        style={{ lineHeight: 0, cursor: 'pointer', borderRadius: 8, overflow: 'hidden', alignSelf: 'flex-start' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {game.isOver ? (
          <button type="button" onClick={restart} style={{ padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>
            {T.restart} (R)
          </button>
        ) : null}
        <span style={dim}>{hint}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={dim}>{T.score(game.score, game.best)}</span>
        <button
          type="button"
          title={T.sound}
          aria-label={T.sound}
          onClick={() => {
            const next = !muted
            setMuted(next)
            save('muted', next)
            host.current?.focus()
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: muted ? 0.35 : 0.8, fontSize: 15 }}
        >
          ♪
        </button>
      </div>
    </div>
  )
}

function HopIcon(): React.ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2" y="5" width="12" height="8" rx="3" fill="#4D6BFE" />
      <rect x="0" y="3" width="3" height="3" fill="#3A56D8" />
      <rect x="9" y="7" width="2" height="2" fill="#1B1F3B" />
    </svg>
  )
}

function HopTitle(): React.ReactNode {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <HopIcon />
      {T.title}
    </span>
  )
}

// 输入框上方的提示条：Agent 一轮干了 5 秒还没完才出现
function HopHint(props: { sessionId: string; open: () => void }): React.ReactNode {
  useVersion()
  const r = runningOf(props.sessionId)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (r.since === null) return
    const wait = r.since + HINT_AFTER_MS - Date.now()
    if (wait <= 0) return
    const t = setTimeout(() => setTick(x => x + 1), wait + 20)
    return () => clearTimeout(t)
  }, [r.since])
  if (r.since === null || r.muted || bodyShown > 0 || Date.now() - r.since < HINT_AFTER_MS) return null
  const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', margin: '0 0 6px', borderRadius: 10, border: '1px solid rgba(127,127,127,.25)', fontSize: 13 }}>
      <HopIcon />
      <span style={{ opacity: 0.7 }}>{T.busy}</span>
      <button type="button" onClick={props.open} style={{ ...link, color: '#4D6BFE', fontWeight: 600 }}>
        {T.play}
      </button>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        onClick={() => {
          running.set(props.sessionId, { ...runningOf(props.sessionId), muted: true })
          emit()
        }}
        style={{ ...link, opacity: 0.55 }}
      >
        {T.mute}
      </button>
    </div>
  )
}

// ---------- 插件入口 ----------
type Ctx = {
  effect: (fn: () => () => void, label?: string) => void
  slots: {
    inject: (name: string, fn: () => unknown) => void
    register: (options: Record<string, unknown>, component: unknown) => unknown
  }
  sidebarRight: { openTabIn: (sessionId: string, kind: string, options?: Record<string, unknown>) => void }
  sidebarRightTabs: { register: (definition: Record<string, unknown>) => () => void }
  remote: { $on: (event: string, fn: (...args: never[]) => void) => () => void }
}

export const inject = ['slots', 'sidebarRight', 'sidebarRightTabs', 'remote']

export function apply(ctx: Ctx): void {
  const seenSessions = new Set<string>()
  if (load("debug", false)) Object.assign(globalThis, { __hopSetRunning: setRunning, __hopSessions: seenSessions })
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: ID,
        kind: KIND,
        title: () => T.title,
        guide: [{ id: 'hop', order: 90, title: () => T.title, description: () => T.guide, icon: HopIcon }],
      }),
    'agihunt-hop.type',
  )
  ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID, inject: (sessionId: string) => ({ sessionId }) }, HopBody),
  )
  ctx.slots.inject('sidebar.right.pane.tab.title', () =>
    ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: ID }, HopTitle),
  )
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'agihunt-hop.hint',
        order: 50,
        inject: (sessionId: string) => {
          seenSessions.add(sessionId)
          return { sessionId, open: () => ctx.sidebarRight.openTabIn(sessionId, KIND) }
        },
      },
      HopHint,
    ),
  )
  ctx.effect(
    () =>
      ctx.remote.$on('api-session/status', ((sessionId: string, isRunning: boolean) => setRunning(sessionId, isRunning)) as never),
    'agihunt-hop.status',
  )
}
