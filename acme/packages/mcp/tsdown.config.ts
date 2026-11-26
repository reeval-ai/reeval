import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outExtensions: () => ({ js: '.mjs' }),
  deps: { alwaysBundle: [/.*/] },
  dts: false,
  clean: true,
})
