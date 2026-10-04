import type { Register } from 'claude-code'

// 改名时，把这里、plugin.json 的 name、types/index.d.ts 里的键一起改掉
const PANE = 'starter-mod'
const CLICKS = { plugin: 'starter-mod', key: 'clicks' } as const

export const register: Register = on => {
  // 会话开始：注册命令。immediate 让 Claude 干活时输入命令也能马上执行
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'starter', description: '打开起步模板的面板', immediate: true })
    return next(e)
  })

  // 命令：打开面板。不回文字，免得在对话里留一行
  on('command.run', { command: 'starter' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Starter', focus: true })
    return {}
  })

  // 面板：读 $.state 画界面；按钮里改 $.state，读到它的界面会自动重画
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { value: clicks = 0 } = await $.state.get(CLICKS)
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>Hello from a mod</Text>
        <Text dimColor>{`clicked ${clicks} times`}</Text>
        <Button key="click" label="Click" onPress={() => void $.state.set(CLICKS, clicks + 1)} />
      </Box>
    )
  })
}
