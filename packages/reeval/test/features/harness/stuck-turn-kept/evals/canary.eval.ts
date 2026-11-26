import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const aborted = defineGrader('aborted', {
  grade: (c) => c.turns[0]?.status ?? null,
  score: (status) => (status === 'aborted' ? 1 : 0),
})

// Must fail: a turn that ends inside the timeout was never cut off.
export default defineEval({
  environment: plain,
  timeout: '60s',
  graders: [aborted],
  task: async (c) => {
    await c.send('Run `echo step-1`, write notes.txt, then wait.')
  },
})
