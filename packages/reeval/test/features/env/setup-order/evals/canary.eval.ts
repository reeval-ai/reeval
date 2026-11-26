import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ordered } from './env.ts'

// Must fail: the extending environment's step doesn't run first.
export default defineEval({
  environment: ordered,
  graders: [observed<string | null>('order.txt', (text) => !!text?.includes('two\none\n'))],
  task: async (c) => {
    await c.exec('true')
    c.observe('order.txt', await c.readFile('order.txt'))
  },
})
