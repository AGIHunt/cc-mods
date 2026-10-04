// 中英双语：默认跟随系统语言（macOS 的 AppleLanguages 第一项），中文用 zh，其余一律 en

export type Lang = 'zh' | 'en'

const STRINGS = {
  zh: {
    command: '蹦一蹦：等 Claude 的时候跳几下',
    opened: '开跳：点面板下面的框，按住空格蓄力，松开起跳。',
    notOpened: '面板没能打开：',
    toastDone: 'Claude 干完了，回来看看吧',
    loading: '正在摆方块……',
    desktopOnly: '蹦一蹦需要在 Claude 桌面端里玩。',
    placeholder: '点这里，按住空格蓄力，松开起跳',
    hintIdle: '点左边的框，按住空格蓄力，松开起跳',
    held: (s: string) => `按了 ${s} 秒`,
    restart: '再来一局',
    scoreLine: (score: number, best: number) => `本局 ${score} · 最高 ${best}`,
    sceneHint: '按住空格蓄力，松开起跳',
    best: (n: number) => `最高 ${n}`,
    fell: '掉下去了',
    stayed: '原地踏步也算输',
    record: '新纪录！',
    perfect: '完美',
    perfectN: (n: number) => `完美 ×${n}`,
    terminal: '>_ 终端 +3',
    coffee: '续命咖啡 +3',
    test: '测试全绿 +5',
    git: '合进 main +5',
    you: '你',
    lbInvite: '加入排行榜，和大家比一比？只上传昵称和成绩，随时可以退出。',
    lbNick: '起个昵称，回车加入',
    lbTabs: { today: '今日', week: '本周', all: '总榜' } as Record<string, string>,
    lbMe: (rank: number, score: number) => `你：第 ${rank} 名（${score} 分）`,
    lbNotRanked: '你还没上榜，打一局试试',
    lbEmpty: '榜上还没人',
    lbLeave: '退出排行榜',
    lbLeft: '已退出，数据已删除',
    lbOffline: '排行榜暂时连不上',
    lbLoading: '正在加载排行榜……',
    lbBadNick: '这个昵称不能用，换一个吧',
    lbTooFast: '太快了，稍后再试',
    bandBusy: 'Claude 还在干活',
    bandPlay: '蹦一蹦',
    bandMute: '本会话不再提示',
    needsYou: 'Claude 在等你',
    doneNow: 'Claude 干完了',
    backToClaude: '回到 Claude',
  },
  en: {
    command: 'Hop: a little game to play while Claude works',
    opened: 'Click the box under the game, hold Space to charge, release to jump.',
    notOpened: 'Could not open the pane: ',
    toastDone: 'Claude is done. Come take a look',
    loading: 'Setting up the blocks…',
    desktopOnly: 'Hop runs in the Claude desktop app.',
    placeholder: 'Click here, hold Space, release to jump',
    hintIdle: 'Click the box, hold Space to charge, release to jump',
    held: (s: string) => `Held ${s}s`,
    restart: 'Play again',
    scoreLine: (score: number, best: number) => `Score ${score} · Best ${best}`,
    sceneHint: 'Hold Space to charge, release to jump',
    best: (n: number) => `Best ${n}`,
    fell: 'You fell off',
    stayed: 'No standing still',
    record: 'New record!',
    perfect: 'Perfect',
    perfectN: (n: number) => `Perfect ×${n}`,
    terminal: '>_ Terminal +3',
    coffee: 'Coffee +3',
    test: 'Tests green +5',
    git: 'Merged +5',
    you: 'You',
    lbInvite: 'Join the leaderboard? Only your nickname and scores are sent. Leave any time.',
    lbNick: 'Pick a nickname, press Enter',
    lbTabs: { today: 'Today', week: 'Week', all: 'All time' } as Record<string, string>,
    lbMe: (rank: number, score: number) => `You: #${rank} (${score})`,
    lbNotRanked: 'Not ranked yet. Play a round',
    lbEmpty: 'No one here yet',
    lbLeave: 'Leave leaderboard',
    lbLeft: 'Left. Your data was deleted',
    lbOffline: 'Leaderboard is unreachable right now',
    lbLoading: 'Loading leaderboard…',
    lbBadNick: 'That nickname is not allowed. Try another',
    lbTooFast: 'Too fast. Try again in a moment',
    bandBusy: 'Claude is still working',
    bandPlay: 'Play Hop',
    bandMute: 'Not this session',
    needsYou: 'Claude needs you',
    doneNow: 'Claude is done',
    backToClaude: 'Back to Claude',
  },
}

let current: Lang = 'zh'

export const setLang = (l: Lang): void => {
  current = l
}
export const lang = (): Lang => current
export const tr = () => STRINGS[current]

// 从 `defaults read -g AppleLanguages` 的输出里取第一项
export function langFromAppleLanguages(out: string): Lang {
  const first = out.match(/"?([A-Za-z]{2,3})[-_A-Za-z]*"?/)?.[1]?.toLowerCase() ?? ''
  return first === 'zh' ? 'zh' : 'en'
}
