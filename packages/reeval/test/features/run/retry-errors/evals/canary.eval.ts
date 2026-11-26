import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { retry } from './env.ts'

// Must fail: the retry runs the eval body again, so it reads the file rather than ending in the
// first run's infra error.
export default defineEval({
  environment: retry,
  graders: [observed('marker.txt', (marker) => marker === 'errored')],
  task: async (c) => {
    await c.send('Say done.')
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
