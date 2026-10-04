import type { Register } from 'claude-code'

import type { Board, BoardEntry, BoardTab, ClaudeStatus, Game, View } from '../types'
import type { Fact } from './facts'
import { queueFor, setFacts } from './facts'
import { jump, newGame, SPECIAL } from './game'
import { lang, langFromAppleLanguages, setLang, tr } from './i18n'
import { ANIM_MS, chargeFrame, H, jumpFrame, stillFrame, W } from './scene'

const PANE = 'hop'
const TITLE = '蹦一蹦'
const VIEW = { plugin: 'hop', key: 'view' } as const
const TICK = { plugin: 'hop', key: 'tick' } as const
const BOARD = { plugin: 'hop', key: 'board' } as const
const CLAUDE = { plugin: 'hop', key: 'claude' } as const
const IDLE: ClaudeStatus = { busy: false, needsYou: false, done: false, hint: false }
const EMPTY: View = { game: null, before: null, phase: 'idle', jump: null, hint: '', pad: 0, chargeAt: 0, jumpAt: 0, startedAt: 0 }
const NO_BOARD: Board = { joined: false, nickname: '', tab: 'today', entries: [], me: null, status: '', busy: false }

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

// 排行榜（agihunt.info 后端）：自愿加入；身份是本机随机生成的 player_id + secret，存在插件自己的 store 里
const LB_BASE = 'https://agihunt.info/agent/v1/hop'
const VERSION = '0.2.0'
type Identity = { playerId: string; secret: string; nickname: string; joined: boolean }
type Lb = {
  refresh: (tab?: BoardTab) => Promise<void>
  join: (nickname: string, game: Game | null, durationMs: number) => Promise<void>
  submit: (game: Game, durationMs: number) => Promise<void>
  leave: () => Promise<void>
}
// session.start 里建好，渲染时的按钮也用它
let lb: Lb | null = null

// 出现时机：Claude 一轮跑了几秒还没完，才在输入框上方提示；需要你时让开；闲着时不出现。
// 全程只画界面、只观察事件，不往对话里写任何东西。
type Options = { autoHint?: boolean; hintAfterSeconds?: number; autoOpen?: boolean }
let opts: Options = {}
let turnStart = 0
let hinted = false
let hintMuted = false
// 刚输入了 /hop：用来认出它前面那行说明
let hopPending = false
let chargeSound: { return?: (v?: undefined) => unknown } | null = null

export const register: Register = (on, options) => {
  opts = (options ?? {}) as Options
  on('session.start', async ($, e, next) => {
    const langs = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages']).catch(() => null)
    setLang(langFromAppleLanguages(langs?.stdout ?? ''))
    await $.command.register({ name: 'hop', description: tr().command, immediate: true })
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

    // 排行榜接口
    const call = async (method: string, path: string, body?: unknown) => {
      try {
        const r = await $.http.fetch(`${LB_BASE}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', 'User-Agent': `agihunt-hop/${VERSION}` },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        let data: Record<string, unknown> | null = null
        try {
          data = JSON.parse(r.text) as Record<string, unknown>
        } catch {
          data = null
        }
        return { ok: r.ok, status: r.status, data }
      } catch {
        return { ok: false, status: 0, data: null }
      }
    }
    const errorText = (data: Record<string, unknown> | null, status: number): string => {
      const code = (data?.error as { code?: string } | undefined)?.code ?? ''
      if (code.startsWith('nickname')) return tr().lbBadNick
      if (status === 429) return tr().lbTooFast
      return tr().lbOffline
    }
    const identity = async (): Promise<Identity> => {
      const saved = (await $.store.get('lb')) as Identity | undefined
      if (saved?.playerId) return saved
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      const secret = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const fresh: Identity = { playerId: crypto.randomUUID(), secret, nickname: '', joined: false }
      await $.store.set('lb', fresh)
      return fresh
    }
    const patch = async (change: Partial<Board>) => {
      const { value: b = NO_BOARD } = await $.state.get(BOARD)
      await $.state.set(BOARD, { ...b, ...change })
    }
    lb = {
      refresh: async tab => {
        const id = await identity()
        const { value: b = NO_BOARD } = await $.state.get(BOARD)
        const board = tab ?? b.tab
        await patch({ tab: board, busy: true })
        const r = await call('GET', `/leaderboard?board=${board}&limit=10&player_id=${id.playerId}`)
        if (!r.ok || !r.data) {
          await patch({ busy: false, status: tr().lbOffline })
          return
        }
        const raw = (r.data.entries ?? []) as { rank: number; nickname: string; score: number; is_me?: boolean }[]
        const entries: BoardEntry[] = raw.map(e => ({ rank: e.rank, nickname: e.nickname, score: e.score, isMe: e.is_me === true }))
        const me = r.data.me as { rank: number; score: number } | null
        await patch({ busy: false, status: '', entries, me: me ? { rank: me.rank, score: me.score } : null })
      },
      submit: async (game, durationMs) => {
        const id = await identity()
        if (!id.joined || game.score < 1) return
        const r = await call('POST', '/scores', {
          player_id: id.playerId,
          secret: id.secret,
          score: game.score,
          jumps: game.jumps,
          perfects: game.perfects,
          duration_ms: Math.max(0, Math.round(durationMs)),
          client_version: VERSION,
          lang: lang(),
        })
        if (!r.ok) await patch({ status: errorText(r.data, r.status) })
        await lb?.refresh()
      },
      join: async (nickname, game, durationMs) => {
        const name = nickname.trim()
        if (!name) return
        const id = await identity()
        await patch({ busy: true, status: '' })
        const r = await call('PUT', '/player', {
          player_id: id.playerId,
          secret: id.secret,
          nickname: name,
          client_version: VERSION,
          lang: lang(),
        })
        if (!r.ok) {
          await patch({ busy: false, status: errorText(r.data, r.status) })
          return
        }
        const saved = (r.data?.nickname as string | undefined) ?? name
        await $.store.set('lb', { ...id, nickname: saved, joined: true })
        await patch({ joined: true, nickname: saved, busy: false })
        // 刚加入：把这一局也算上
        if (game?.isOver) await lb?.submit(game, durationMs)
        else await lb?.refresh()
      },
      leave: async () => {
        const id = await identity()
        const r = await call('DELETE', '/player', { player_id: id.playerId, secret: id.secret })
        if (!r.ok) {
          await patch({ status: errorText(r.data, r.status) })
          return
        }
        await $.store.set('lb', { ...id, nickname: '', joined: false })
        await $.state.set(BOARD, { ...NO_BOARD, status: tr().lbLeft })
      },
    }
    const known = (await $.store.get('lb')) as Identity | undefined
    if (known?.joined) await patch({ joined: true, nickname: known.nickname })

    // 每帧：按住或起跳动画期间请求重画；同时盯着输入，空格停了就起跳
    holdStart = 0
    animUntil = 0
    $.clock.every(FRAME_MS, () => {
      void $.clock.now().then(async now => {
        // 用状态驱动重画（和按键触发的重画走同一条路，不会丢键盘焦点）
        const after = (opts.hintAfterSeconds ?? 5) * 1000
        if (turnStart !== 0 && !hinted && now - turnStart >= after) {
          hinted = true
          const { value: c = IDLE } = await $.state.get(CLAUDE)
          if (c.busy && !c.needsYou && (opts.autoHint ?? true) && !hintMuted) {
            if (opts.autoOpen) void $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
            else await $.state.set(CLAUDE, { ...c, hint: true })
          }
        }
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
            startedAt: v.startedAt || v.chargeAt,
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
          if (result.game.isOver) void lb?.submit(result.game, now - (v.startedAt || v.chargeAt))
          if (result.game.isOver) void lb?.refresh()
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

  // /hop 本身会在对话里留两行（Claude Code 的说明 + 命令名），模型下一轮读得到。
  // 这两行的内容清空：它们只是打开游戏面板的记录，对 Claude 没有用。
  on('session.append', async ($, e, next) => {
    if (e.door !== 'command') return next(e)
    const text = JSON.stringify(e.message.content)
    const isHop = text.includes('<command-name>/hop</command-name>')
    if (isHop || (text.includes('local-command-caveat') && hopPending)) {
      if (isHop) hopPending = false
      return next({ ...e, message: { ...e.message, content: [] } })
    }
    return next(e)
  })

  on('command.run', { command: 'hop' }, async $ => {
    // 命令先运行、后入对话记录：先记一笔，下面 session.append 认出这一次的两行
    hopPending = true
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    // 不回任何文字，免得在对话里留一行
    return {}
  })

  // 一轮开始：开始计时，几秒后再决定要不要提示
  on('turn.start', async ($, e, next) => {
    turnStart = await $.clock.now()
    hinted = false
    hopPending = false
    await $.state.set(CLAUDE, { busy: true, needsYou: false, done: false, hint: false })
    return next(e)
  })

  // Claude 停下来等你（要授权、在问你问题）：提示条让开，面板顶上提醒你回去
  on('classic.Notification', async ($, e, next) => {
    const { value: c = IDLE } = await $.state.get(CLAUDE)
    if (c.busy) {
      await $.state.set(CLAUDE, { ...c, needsYou: true, hint: false })
      const panes = await $.ui.panes().catch(() => [])
      if (panes.some(p => p.id === PANE && p.isPlaced)) $.ui.toast(tr().needsYou)
    }
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const { value: c = IDLE } = await $.state.get(CLAUDE)
    if (c.busy && !c.needsYou) await $.state.set(CLAUDE, { ...c, needsYou: true, hint: false })
    return next(e)
  })

  // 你处理完、Claude 接着跑工具了：清掉「在等你」
  on('tool.call', async ($, e, next) => {
    const { value: c = IDLE } = await $.state.get(CLAUDE)
    if (c.needsYou) await $.state.set(CLAUDE, { ...c, needsYou: false })
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    turnStart = 0
    await $.state.set(CLAUDE, { busy: false, needsYou: false, done: true, hint: false })
    const panes = await $.ui.panes().catch(() => [])
    if (panes.some(p => p.id === PANE && p.isPlaced)) $.ui.toast(tr().toastDone)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { value: c = IDLE } = await $.state.get(CLAUDE)
    if (!c.hint || c.needsYou || !c.busy || hintMuted || e.props.hasSurvey) return next(e)
    const panes = await $.ui.panes().catch(() => [])
    if (panes.some(p => p.id === PANE && p.isPlaced)) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text dimColor>{tr().bandBusy}</Text>
        <Button
          key="hop-open"
          label={tr().bandPlay}
          variant="primary"
          onPress={() =>
            void $.ui.open({ id: PANE, title: TITLE, focus: true }).then(() => $.state.set(CLAUDE, { ...c, hint: false }))
          }
        />
        <Button
          key="hop-mute"
          label={tr().bandMute}
          plain
          dimColor
          onPress={() => {
            hintMuted = true
            void $.state.set(CLAUDE, { ...c, hint: false })
          }}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const t = $.ui.resolve(e)
    const { Box, Text, Button } = t
    const { value: view = EMPTY } = await $.state.get(VIEW)
    const { value: board = NO_BOARD } = await $.state.get(BOARD)
    const { value: claude = IDLE } = await $.state.get(CLAUDE)
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
          await $.state.set(VIEW, { ...v, phase: 'charge', chargeAt: now, startedAt: v.startedAt || now })
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
        await $.state.get(BOARD).then(({ value: b = NO_BOARD }) => $.state.set(BOARD, { ...b, status: '' }))
      })

    return (
      <Box flexDirection="column" gap={1}>
        {(claude.needsYou || claude.done) && (
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text bold color={claude.needsYou ? '#E63946' : '#2A9D8F'}>
              {claude.needsYou ? tr().needsYou : tr().doneNow}
            </Text>
            <Button
              key="back"
              label={tr().backToClaude}
              plain
              onPress={() =>
                void $.state
                  .set(CLAUDE, { ...claude, done: false })
                  .then(() => $.ui.close({ id: PANE }))
                  .catch(() => undefined)
              }
            />
          </Box>
        )}
        {/* 不加 isInteractive：当普通图片显示，换图不闪 */}
        <t.Svg source={svg} alt={`蹦一蹦，当前 ${game.score} 分`} width={W} height={H} />
        <Box flexDirection="row" gap={1} alignItems="center">
          {game.isOver ? (
             <Button key="restart" label={tr().restart} hotkey={board.joined ? 'r' : undefined} variant="primary" autoFocus onPress={restart} />
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
        {game.isOver && (
          <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
            {board.joined ? (
              <Box flexDirection="column">
                <Box flexDirection="row" gap={2}>
                  {(['today', 'week', 'all'] as const).map(tab => (
                    <Button
                      key={`tab-${tab}`}
                      label={tr().lbTabs[tab]}
                      plain
                      dimColor={board.tab !== tab}
                      onPress={() => void lb?.refresh(tab)}
                    />
                  ))}
                </Box>
                {board.busy && board.entries.length === 0 ? (
                  <Text dimColor>{tr().lbLoading}</Text>
                ) : board.entries.length === 0 ? (
                  <Text dimColor>{tr().lbEmpty}</Text>
                ) : (
                  board.entries.map(en => (
                    <Text bold={en.isMe} color={en.isMe ? '#D97757' : undefined}>
                      {`${String(en.rank).padStart(2, ' ')}. ${en.nickname}  ${en.score}`}
                    </Text>
                  ))
                )}
                <Box flexDirection="row" justifyContent="space-between">
                  <Text dimColor>{board.me ? tr().lbMe(board.me.rank, board.me.score) : tr().lbNotRanked}</Text>
                  <Button key="lb-leave" label={tr().lbLeave} plain dimColor onPress={() => void lb?.leave()} />
                </Box>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Text dimColor wrap="wrap">
                  {tr().lbInvite}
                </Text>
                <Box width={28}>
                  <t.Input
                    key="lb-nick"
                    placeholder={tr().lbNick}
                    onSubmit={name => void lb?.join(name, game, view.jumpAt - (view.startedAt || view.jumpAt))}
                  />
                </Box>
              </Box>
            )}
            {board.status !== '' && <Text color="#E76F51">{board.status}</Text>}
          </Box>
        )}
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
