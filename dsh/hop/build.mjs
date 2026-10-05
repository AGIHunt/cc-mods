// 把 src/client.tsx（连同复用的 plugins/hop/hooks、卡片和音效）打成 DSH 浏览器端认的 client.js：
// 一个 window.__ModuleLoader__.load({ id, factory(require) }) 调用，React 由宿主的 require 提供。
import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const out = await build({
  entryPoints: [new URL('./src/client.tsx', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  loader: { '.mp3': 'dataurl', '.json': 'json' },
  minify: true,
  legalComments: 'none',
})
const body = out.outputFiles[0].text
const js = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const module = { exports: {} };
    (function (module, exports, require) {
${body}
    })(module, module.exports, require);
    return module.exports;
  },
});
`
writeFileSync(new URL('./client.js', import.meta.url), js)
console.log(`client.js ${(js.length / 1024).toFixed(0)} KB`)
