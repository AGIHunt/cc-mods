// $.state 里存的值要在这里声明类型（插件名 → 键 → 类型），validate 会逐个核对
export type Clicks = number

declare module 'claude-code' {
  interface PluginState {
    'starter-mod': {
      clicks: Clicks
    }
  }
}
