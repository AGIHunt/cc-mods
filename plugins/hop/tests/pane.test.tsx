import { test, expect, mock } from 'claude-code/testing'

async function setup($: any, on: any, store?: Record<string, unknown>) {
  // 传入 store 时用一个测试能直接改的内存 store，模拟另一个会话写进去的东西
  if (store) {
    on('store.get', async (_: unknown, e: { key: string }) => ({ value: store[e.key] }) as never)
    on('store.set', async (_: unknown, e: { key: string; value: unknown }) => {
      store[e.key] = e.value
      return { value: undefined } as never
    })
    on('store.delete', async (_: unknown, e: { key: string }) => {
      delete store[e.key]
      return { value: undefined } as never
    })
    on('store.keys', async () => ({ value: Object.keys(store) }) as never)
  } else mock.store(on, {})
  const clock = mock.clock(on, { now: 1791080000000 })
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' })
  const ui = await $.ui.mount({
    plugin: 'hop', surface: 'desktop', component: 'Pane', requestId: 'hop',
    props: { title: '蹦一蹦', bodyColumns: 80 } as never,
    viewport: { columns: 80, rows: 40 } as never,
  })
  return { clock, ui }
}

test('hold space in the input then release jumps', async ($, on) => {
  const { clock, ui } = await setup($, on)
  await ui.input({ key: 'pad-0', text: ' ', kind: 'change' } as never)
  let s = JSON.stringify(await ui.drawn())
  console.log('charging', s.includes('charge 0'))
  await clock.advance(450)
  for (let i = 0; i < 12; i++) {
    await ui.input({ key: 'pad-0', text: ' '.repeat(i + 2), kind: 'change' } as never)
    await clock.advance(30)
  }
  await clock.advance(300)
  s = JSON.stringify(await ui.drawn())
  console.log('jumped', s.includes('jump 1'), s.match(/(按了|Held) [^"]*/)?.[0], 'card', s.includes('stroke-dasharray='), 'new pad', s.includes('pad-1'))
  expect(s.includes('jump 1')).toBe(true)
})

test('a quick tap still hops (a short hop)', async ($, on) => {
  const { clock, ui } = await setup($, on)
  await ui.input({ key: 'pad-0', text: ' ', kind: 'change' } as never)
  await clock.advance(1000)
  const s = JSON.stringify(await ui.drawn())
  console.log('tap hops', s.includes('jump 1') || s.includes('still 1'))
  expect(s.includes('jump 1') || s.includes('still 1')).toBe(true)
})

test('after the jump plays, the scene settles to a still frame', async ($, on) => {
  const { clock, ui } = await setup($, on)
  await ui.input({ key: 'pad-0', text: ' ', kind: 'change' } as never)
  await clock.advance(450)
  for (let i = 0; i < 10; i++) {
    await ui.input({ key: 'pad-0', text: ' '.repeat(i + 2), kind: 'change' } as never)
    await clock.advance(30)
  }
  await clock.advance(150)
  let s = JSON.stringify(await ui.drawn())
  console.log('right after release: jump frame', s.includes('jump 1'))
  await clock.advance(2000)
  s = JSON.stringify(await ui.drawn())
  console.log('frames stop after the animation; last frame is still', s.includes('still 1'))
  console.log('after settle: still frame', s.includes('still 1'), !s.includes('jump 1'))
  expect(s.includes('still 1')).toBe(true)
})

test('leaderboard: join after a lost round submits the score and shows the board', async ($, on) => {
  const calls: string[] = []
  on('http.fetch', async (_, e) => {
    const { url, init } = e as unknown as { url: string; init?: { method?: string; body?: string } }
    calls.push(`${init?.method ?? 'GET'} ${url.replace('https://agihunt.info/agent/v1/hop', '')}`)
    if (url.includes('/leaderboard')) {
      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ entries: [{ rank: 1, nickname: '跳跳王', score: 9, is_me: true }], me: { rank: 1, score: 9 } }) } } as never
    }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ok: true, nickname: '跳跳王' }) } } as never
  })
  const { clock, ui } = await setup($, on)
  // 轻点一下：短跳落回原地，判输
  await ui.input({ key: 'pad-0', text: ' ', kind: 'change' } as never)
  await clock.advance(2500)
  let s = JSON.stringify(await ui.drawn())
  console.log('over, invite shown', s.includes('lb-nick'))
  await ui.input({ key: 'lb-nick', text: '跳跳王', kind: 'submit' } as never)
  await clock.advance(100)
  s = JSON.stringify(await ui.drawn())
  console.log('calls', calls.join(' | '))
  console.log('board shows me', s.includes('跳跳王'), s.includes('tab-week'))
  expect(calls.some(c => c.startsWith('PUT /player'))).toBe(true)
})

const ME = { playerId: '00000000-0000-4000-8000-000000000001', secret: 'x'.repeat(43), nickname: '跳跳王', joined: true }

test('leaderboard: joined in another session, a failed upload is retried, best follows the store', async ($, on) => {
  const calls: string[] = []
  let isDown = true
  on('http.fetch', async (_, e) => {
    const { url, init } = e as unknown as { url: string; init?: { method?: string } }
    calls.push(`${init?.method ?? 'GET'} ${url.replace('https://agihunt.info/agent/v1/hop', '').split('?')[0]}`)
    if (isDown) throw new Error('offline')
    if (url.includes('/leaderboard')) {
      return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ entries: [{ rank: 1, nickname: '跳跳王', score: 9, is_me: true }], me: { rank: 1, score: 9 } }) } } as never
    }
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } } as never
  })
  // 这个会话开局时还没加入；另一个会话随后加入了，并刷出了 146 的纪录
  const store: Record<string, unknown> = {}
  const { clock, ui } = await setup($, on, store)
  store.lb = ME
  store.best = 146
  store.bestRun = { score: 146, jumps: 50, perfects: 30, durationMs: 90000 }
  store.pending = [{ score: 146, jumps: 50, perfects: 30, durationMs: 90000 }]
  await ui.input({ key: 'pad-0', text: ' ', kind: 'change' } as never)
  await clock.advance(2500)
  let s = JSON.stringify(await ui.drawn())
  console.log('no nickname prompt', !s.includes('lb-nick'), 'offline + retry', s.includes('lb-retry'), 'best 146', /最高 146|Best 146/.test(s))
  expect(s.includes('lb-nick')).toBe(false)
  expect(s.includes('lb-retry')).toBe(true)
  expect(/最高 146|Best 146/.test(s)).toBe(true)
  // 网络恢复，点重试：先补传没传上去的成绩，再拉榜
  isDown = false
  calls.length = 0
  await ui.press({ key: 'lb-retry' } as never)
  await clock.advance(100)
  s = JSON.stringify(await ui.drawn())
  console.log('retry calls', calls.join(' | '))
  expect(calls[0]).toBe('POST /scores')
  expect(calls.includes('GET /leaderboard')).toBe(true)
  expect(s.includes('lb-retry')).toBe(false)
})

test('timing: hint shows 5s into a turn, steps aside when Claude needs you, /hop prints nothing', async ($, on) => {
  on('turn.start', async (_, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
  on('ui.panes', async () => ({ value: [] }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('classic.Notification', async () => ({}) as never)
  on('command.run', async () => ({ text: 'ENGINE' }) as never)
  on('ui.render', { component: 'AbovePrompt' }, async ($$, e) => ($$ as any).ui.resolve(e).Text({ children: 'engine band' }))
  const { clock } = await setup($, on)
  const band = await $.ui.mount({ plugin: 'hop', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false } as never, viewport: { columns: 100, rows: 40 } as never })
  await ($ as any).turn.start({ text: 'do something', turnId: 't1' })
  await clock.advance(3000)
  let s = JSON.stringify(await band.drawn())
  console.log('3s: no hint', !s.includes('hop-open'))
  await clock.advance(2500)
  s = JSON.stringify(await band.drawn())
  console.log('5.5s: hint', s.includes('hop-open'))
  await ($ as any).classic.Notification({ message: 'Claude needs your permission', notification_type: 'permission_prompt' })
  s = JSON.stringify(await band.drawn())
  console.log('needs you: hint gone', !s.includes('hop-open'))
  const r = await ($ as any).command.run({ command: 'hop', args: '' }).catch((err: unknown) => ({ err: String(err) }))
  console.log('/hop result', JSON.stringify(r))
  expect(s.includes('hop-open')).toBe(false)
})
