import type { Register } from 'claude-code'

import type { View } from '../types'
import type { Fact } from './facts'
import { queueFor, setFacts } from './facts'
import { jump, newGame, SPECIAL } from './game'
import { langFromAppleLanguages, setLang, tr } from './i18n'
import { ANIM_MS, chargeFrame, H, jumpFrame, stillFrame, W } from './scene'

const PANE = 'hop'
const TITLE = '蹦一蹦'
const VIEW = { plugin: 'hop', key: 'view' } as const
const TICK = { plugin: 'hop', key: 'tick' } as const
const EMPTY: View = { game: null, before: null, phase: 'idle', jump: null, hint: '', pad: 0, chargeAt: 0, jumpAt: 0 }

// 桌面端拿不到「按下 / 松开」，按钮快捷键也收不到按住时的重复按键。
// 输入框能收到：在框里按住空格，系统会不停往里打空格，每打一个都通知插件；
// 空格停了就当松手。系统要按住一会儿才开始重复，这段时间内松开的算轻点。
const RELEASE_GAP_MS = 100
// 系统开始重复前要按住多久（macOS 的 InitialKeyRepeat × 15ms），开机时读一次
let repeatDelayMs = 450
// 画面是静态图，动画由插件逐帧重画：按住和起跳期间每 33 毫秒画一帧，其余时间不动
const FRAME_MS = 33

let holdStart = 0
let lastPress = 0
let presses = 0
// 起跳动画画到什么时候为止
let animUntil = 0
// 声音：用系统自带的 afplay 播 sounds/ 下的 wav；蓄力那段按多久响多久，松手就掐掉
const FLY_MS = 450
const VOLUME = '0.6'
let muted = false
// 待机时也画小动作（呼吸、眨眼、挥手），但只在面板露着的时候，大约每秒 10 帧
const IDLE_FRAME_MS = 100
let isShown = false
let lastIdleFrame = 0
let lastShownCheck = 0
// 每局最多预排多少条冷知识
const QUEUE = 80
let chargeSound: { return?: (v?: undefined) => unknown } | null = null

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const langs = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages']).catch(() => null)
    setLang(langFromAppleLanguages(langs?.stdout ?? ''))
    await $.command.register({ name: 'hop', description: tr().command })
    const data = await $.fs.read(`${$.plugin.root}/data/facts.json`).catch(() => null)
    if (data) setFacts(JSON.parse(data) as Fact[])
    const { value: view = EMPTY } = await $.state.get(VIEW)
    muted = (await $.store.get('muted')) === true
    const delay = await $.process.run(['defaults', 'read', '-g', 'InitialKeyRepeat']).catch(() => null)
    const ticks = Number(delay?.stdout.trim())
    repeatDelayMs = Number.isFinite(ticks) && ticks > 0 ? ticks * 15 : 450
    if (!view.game) {
      const best = Number((await $.store.get('best')) ?? 0)
      const seed = Math.floor((await $.clock.now()) % 2147483647)
      const seen = ((await $.store.get('seen')) ?? []) as string[]
      await $.state.set(VIEW, { ...EMPTY, game: newGame(seed, best, queueFor(seen, seed).slice(0, QUEUE)) })
    }

    // 每帧：按住或起跳动画期间请求重画；同时盯着输入，空格停了就起跳
    holdStart = 0
    animUntil = 0
    $.clock.every(FRAME_MS, () => {
      void $.clock.now().then(async now => {
        // 用状态驱动重画（和按键触发的重画走同一条路，不会丢键盘焦点）
        const isAnimating = holdStart !== 0 || now < animUntil + 2 * FRAME_MS
        if (now - lastShownCheck > 1000) {
          lastShownCheck = now
          isShown = (await $.ui.panes().catch(() => [])).some(p => p.id === PANE && p.isShown && p.isPlaced)
        }
        if (isAnimating || (isShown && now - lastIdleFrame >= IDLE_FRAME_MS)) {
          lastIdleFrame = now
          await $.state.set(TICK, now)
        }
        if (holdStart === 0) return
        const gap = now - lastPress
        const isTap = presses < 2 && gap > repeatDelayMs + 80
        const isReleased = presses >= 2 && gap > RELEASE_GAP_MS
        if (!isTap && !isReleased) return

        // 轻点：系统还没开始重复就松手了，量不出具体时长，按一下短按来跳
        const held = isTap ? Math.min(250, repeatDelayMs * 0.5) : lastPress - holdStart + 30
        holdStart = 0
        presses = 0
        void chargeSound?.return?.()
        chargeSound = null

        const { value: v = EMPTY } = await $.state.get(VIEW)
        const g = v.game
        // 换一个新的空输入框，焦点跟过去，攒下的空格就清掉了
        const pad = v.pad + 1
        if (!g || g.isOver) return
        {
          const result = jump(g, held)
          await $.state.set(VIEW, {
            game: result.game,
            before: g,
            phase: 'jump',
            jump: result.jump,
            hint: tr().held((held / 1000).toFixed(2)),
            pad,
            chargeAt: v.chargeAt,
            jumpAt: now,
          })
          animUntil = now + ANIM_MS
          // 真的落到这块上了，它的冷知识才算看过
          const shown = result.jump.result === 'land' ? g.blocks[g.cur + 1].fact : null
          if (shown) {
            const seen = ((await $.store.get('seen')) ?? []) as string[]
            if (!seen.includes(shown)) await $.store.set('seen', [...seen, shown])
          }

          // 音效：起跳马上响，落地 / 掉下去等小人到了再响
          const r = result.jump
          const target = g.blocks[g.cur + 1]
          const lastBest = Number((await $.store.get('best')) ?? 0)
          const isRecord = result.game.isOver && result.game.score > lastBest
          if (result.game.isOver && isRecord) await $.store.set('best', result.game.score)
          if (!muted) {
            const root = `${$.plugin.root}/sounds`
            void $.process.run(['afplay', '-v', VOLUME, `${root}/jump.wav`]).catch(() => undefined)
            const landing =
              r.result === 'fall'
                ? ['fall.wav', isRecord ? 'record.wav' : 'over.wav']
                : r.result === 'stay'
                  ? ['land.wav', isRecord ? 'record.wav' : 'over.wav']
                  : ['land.wav', ...(r.isPerfect ? ['perfect.wav'] : []), ...(target.kind in SPECIAL ? ['bonus.wav'] : [])]
            $.clock.after(FLY_MS, () => {
              void (async () => {
                for (const [i, name] of landing.entries()) {
                  if (i > 0) await $.clock.sleep(r.result === 'land' ? 90 : 520)
                  void $.process.run(['afplay', '-v', VOLUME, `${root}/${name}`]).catch(() => undefined)
                }
              })()
            })
          }
        }
        void $.ui.focus({ requestId: PANE, key: `pad-${pad}` }).catch(() => undefined)
      })
    })

    return next(e)
  })

  on('command.run', { command: 'hop' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: TITLE, focus: true })

    return {
      text: opened.isPlaced ? tr().opened : `${tr().notOpened}${opened.reason}`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const panes = await $.ui.panes()
    if (panes.some(p => p.id === PANE && p.isPlaced)) $.ui.toast(tr().toastDone)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const { value: view = EMPTY } = await $.state.get(VIEW)
    const game = view.game

    if (!game) return <Text dimColor>{tr().loading}</Text>
    await $.state.get(TICK)
    const now = await $.clock.now()
    const svg =
      view.phase === 'charge'
        ? chargeFrame(game, now - view.chargeAt)
        : view.phase === 'jump' && view.before && view.jump && now - view.jumpAt < ANIM_MS
          ? jumpFrame(view.before, game, view.jump, now - view.jumpAt, now)
          : stillFrame(game, now)
    if (e.surface === 'terminal' || !('Svg' in t) || !('Input' in t)) {
      return <Text dimColor>{tr().desktopOnly}</Text>
    }

    // 输入框里每多一个空格（按住时系统会不停地打）都会走到这里
    const press = () =>
      void $.clock.now().then(async now => {
        if (holdStart === 0) {
          const { value: v = EMPTY } = await $.state.get(VIEW)
          if (!v.game || v.game.isOver) return
          holdStart = now
          lastPress = now
          presses = 1
          await $.state.set(VIEW, { ...v, phase: 'charge', chargeAt: now })
          if (!muted) {
            const s = $.process.spawn({ argv: ['afplay', '-v', VOLUME, `${$.plugin.root}/sounds/charge.wav`] })
            chargeSound = s
            void (async () => {
              try {
                for await (const _ of s) {
                  // 只是让它响着；松手时 return() 结束循环，afplay 随之退出
                }
              } catch {
                // 播不了就算了
              }
            })()
          }
          return
        }
        lastPress = now
        presses += 1
      })

    const restart = () =>
      void $.clock.now().then(async now => {
        const seed = Math.floor(now % 2147483647)
        const seen = ((await $.store.get('seen')) ?? []) as string[]
        await $.state.set(VIEW, {
          ...EMPTY,
          game: newGame(seed, game.best, queueFor(seen, seed).slice(0, QUEUE)),
          pad: view.pad + 1,
        })
      })

    return (
      <Box flexDirection="column" gap={1}>
        {/* 不加 isInteractive：当普通图片显示，换图不闪 */}
        <t.Svg source={svg} alt={`蹦一蹦，当前 ${game.score} 分`} width={W} height={H} />
        <Box flexDirection="row" gap={1} alignItems="center">
          {game.isOver ? (
             <Button key="restart" label={tr().restart} hotkey="r" variant="primary" autoFocus onPress={restart} />
          ) : (
            // 只有输入框收得到按住空格时的连续输入；宽度固定，空格攒多了也不会把框撑长
            <Box width={34}>
              <t.Input
                key={`pad-${view.pad}`}
                value=""
                placeholder={tr().placeholder}
                autoFocus
                onInput={() => press()}
                onSubmit={() => undefined}
              />
            </Box>
          )}
          <Text dimColor>{view.hint || tr().hintIdle}</Text>
        </Box>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text dimColor>{tr().scoreLine(game.score, game.best)}</Text>
          {/* 声音开关：只有一个音符图标，静音时变暗 */}
          <Button
            key="mute"
            label="♪"
            plain
            dimColor={muted}
            onPress={() => {
              muted = !muted
              void $.store.set('muted', muted)
              void $.state.set(TICK, Date.now())
            }}
          />
        </Box>
      </Box>
    )
  })
}
