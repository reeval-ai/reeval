import { defineEval } from 'reeval'
import { matches } from './graders.ts'

// A judge grader shown each case's reference solution.
export default defineEval({
  cases: [{ key: 'answer', solution: 'forty-two' }],
  graders: [matches],
  task: async (c) => void (await c.send('set the answer')),
})
