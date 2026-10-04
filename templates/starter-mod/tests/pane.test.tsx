import { test, expect } from 'claude-code/testing'

// 在桌面端和终端两种界面上各挂一次面板，按一下按钮，看计数有没有变
for (const surface of ['desktop', 'terminal'] as const) {
  test(`pane counts clicks on ${surface}`, async $ => {
    const ui = await $.ui.mount({
      plugin: 'starter-mod',
      surface,
      component: 'Pane',
      requestId: 'starter-mod',
      props: { title: 'Starter', bodyColumns: 60 } as never,
    })
    await ui.press({ key: 'click' })
    expect(JSON.stringify(await ui.drawn())).toContain('clicked 1 times')
  })
}
