#!/usr/bin/env node
// 检查蹦一蹦的知识卡片：格式、长度、出处、适用端、重复。CI 和本地都跑这个。
// 用法：node scripts/check-facts.mjs [plugins/hop/data/facts.json]
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? new URL('../plugins/hop/data/facts.json', import.meta.url).pathname
const SURFACES = new Set(['all', 'cli', 'desktop', 'ide', 'web', 'mobile'])
const BANNED = ['赋能', '助力', '——']
// 中文按显示宽度算（一个汉字 2、半角 1），卡片一行约 29，最多显示 6 行
const ZH_MAX_WIDTH = 130
const EN_MAX = 140

const width = t => [...t].reduce((a, ch) => a + (ch.codePointAt(0) > 0x2e80 ? 2 : 1), 0)
const errors = []
const fail = (id, msg) => errors.push(`${id}: ${msg}`)

let cards
try {
  cards = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`读不了 ${file}: ${e.message}`)
  process.exit(1)
}
if (!Array.isArray(cards)) {
  console.error('facts.json 应该是一个数组')
  process.exit(1)
}

const seen = new Set()
const texts = new Map()
for (const c of cards) {
  const id = c?.id ?? '(没有 id)'
  if (typeof c.id !== 'string' || !/^[a-z]+-[a-z0-9-]+$/.test(c.id)) fail(id, 'id 要形如 cc-001、ai-120、yourname-001')
  if (seen.has(c.id)) fail(id, 'id 重复')
  seen.add(c.id)
  for (const l of ['zh', 'en']) {
    if (typeof c.tag?.[l] !== 'string' || !c.tag[l].trim()) fail(id, `缺 tag.${l}`)
    if (typeof c[l] !== 'string' || !c[l].trim()) fail(id, `缺 ${l}`)
  }
  if (typeof c.zh === 'string') {
    if (width(c.zh) > ZH_MAX_WIDTH) fail(id, `中文太长（显示宽度 ${width(c.zh)} > ${ZH_MAX_WIDTH}，约 60 个汉字）`)
    for (const w of BANNED) if (c.zh.includes(w)) fail(id, `中文里别用「${w}」`)
    const key = c.zh.replace(/\s+/g, '')
    if (texts.has(key)) fail(id, `和 ${texts.get(key)} 内容重复`)
    texts.set(key, c.id)
  }
  if (typeof c.en === 'string' && c.en.length > EN_MAX) fail(id, `英文太长（${c.en.length} > ${EN_MAX}）`)
  if (c.surface !== undefined && !SURFACES.has(c.surface)) fail(id, `surface 只能是 ${[...SURFACES].join(' / ')}`)
  if (typeof c.source !== 'string' || !/^(https?:\/\/|builtin$)/.test(c.source)) fail(id, 'source 要写出处链接（http/https）')
  if (c.asOf !== undefined && c.asOf !== null && !/^\d{4}-\d{2}$/.test(c.asOf)) fail(id, 'asOf 写成 YYYY-MM，或者 null')
}

if (errors.length) {
  console.error(`✘ ${errors.length} 处问题：\n` + errors.map(e => `  ${e}`).join('\n'))
  process.exit(1)
}
console.log(`✔ ${cards.length} 张卡片检查通过`)
