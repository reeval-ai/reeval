import { defineEval, expect } from 'reeval'

export default defineEval({
  runs: 6,
  task: async (c) => {
    await c.send('Write build.js, which writes "ok" to dist/report.txt.')
    await c.exec('node build.js', { background: true })
    await c.exec('sleep 0.2')
    expect(await c.readFile('dist/report.txt'), 'report says ok').toBe('ok\n')
  },
})
