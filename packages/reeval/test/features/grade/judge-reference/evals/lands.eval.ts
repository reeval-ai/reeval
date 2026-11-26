import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { matches } from './graders.ts'

export default defineEval({
  cases: [{ key: 'answer', solution: 'forty-two' }],
  environment: plain,
  graders: [matches],
  task: async (c) => void (await c.send('set the answer')),
})
