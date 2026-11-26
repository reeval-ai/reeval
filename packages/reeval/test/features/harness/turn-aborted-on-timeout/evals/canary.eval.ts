import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const aborted = defineGrader('aborted', {
  grade: (c) => c.turns[0]?.status ?? null,
  score: (status) => (status === 'aborted' ? 1 : 0),
})

// Must fail: a turn that ends inside the timeout is completed, not aborted.
export default defineEval({
  environment: plain,
  timeout: '60s',
  graders: [aborted],
  task: async (c) => {
    await c.send('Reply with the word done.')
  },
})
