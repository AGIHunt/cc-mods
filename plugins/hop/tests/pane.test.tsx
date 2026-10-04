import { test, expect, mock } from 'claude-code/testing'

async function setup($: any, on: any) {
  mock.store(on, {})
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
  console.log('jumped', s.includes('jump 1'), s.match(/按了 [^"]*/)?.[0], 'card', s.includes('💡'), 'new pad', s.includes('pad-1'))
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
