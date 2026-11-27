import { defineEval, regression } from 'reeval'
import { observed } from 'reeval/graders'

export default defineEval({
  trials: 6,
  graders: [observed<string | null>('report', (text) => text === 'ok\n')],
  target: regression(),
  task: async (c) => {
    await c.send('Write build.js, which writes "ok" to dist/report.txt.')
    await c.exec('node build.js', { background: true })
    await c.exec('sleep 0.2')
    c.observe('report', await c.readFile('dist/report.txt'))
  },
})
