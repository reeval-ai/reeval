import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { matches } from './graders.ts'

export default defineEval({
  // The mistake: this case's reference answers 41, so the attempt doesn't match it.
  cases: [{ key: 'answer', solution: 'forty-one' }],
  environment: plain,
  graders: [matches],
  task: async (c) => void (await c.send('set the answer')),
})
