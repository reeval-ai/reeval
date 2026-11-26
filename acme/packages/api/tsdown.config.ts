import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { node: 'src/node.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.mjs' }),
  deps: { alwaysBundle: [/.*/] },
  dts: false,
  clean: true,
})
