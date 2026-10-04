import { test, expect, mock } from 'claude-code/testing'

for (const phase of ['busy', 'done', 'needs'] as const) {
  test(`pane draws while Claude is ${phase}`, async ($, on) => {
    mock.store(on, {})
    const clock = mock.clock(on, { now: 1791080000000 })
    on('session.start', async () => ({ cwd: '/tmp' }) as never)
    on('command.register', async () => ({ value: undefined }) as never)
    on('turn.start', async (_, e) => ({ turnId: (e as { turnId: string }).turnId }) as never)
    on('turn.complete', async () => ({ text: '' }) as never)
    on('classic.Notification', async () => ({}) as never)
    on('ui.panes', async () => ({ value: [{ id: 'hop', title: 'hop', isShown: true, isFocused: false, isPlaced: true }] }) as never)
    await ($ as any).session.start({ source: 'startup', cwd: '/tmp' })
    await ($ as any).turn.start({ text: 'x', turnId: 't1' })
    if (phase === 'needs') await ($ as any).classic.Notification({ message: 'm', notification_type: 'permission_prompt' })
    if (phase === 'done') await ($ as any).turn.complete({ reason: 'answer', text: 'ok' }).catch((e: unknown) => console.log('tc err', String(e)))
    await clock.advance(6000)
    try {
      const ui = await $.ui.mount({ plugin: 'hop', surface: 'desktop', component: 'Pane', requestId: 'hop', props: { title: 'hop', bodyColumns: 80 } as never, viewport: { columns: 80, rows: 40 } as never })
      const s = JSON.stringify(await ui.drawn())
      console.log(phase, 'ok', s.includes('Svg'), s.includes('back'))
    } catch (err) {
      console.log(phase, 'FAILED', String(err).slice(0, 600))
    }
    expect(1).toBe(1)
  })
}

