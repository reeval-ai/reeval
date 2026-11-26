import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { retry } from './env.ts'

export default defineEval({
  environment: retry,
  graders: [observed('marker.txt', (marker) => marker === 'retry')],
  task: async (c) => {
    await c.send('Say done.')
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
