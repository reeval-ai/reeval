import { defineEval, defineGrader } from 'reeval'
import { prompt, quick } from './env.ts'

const timedOut = defineGrader('timed-out', {
  grade: (c) => c.turns[0]?.status ?? null,
  score: (status) => (status === 'error' ? 1 : 0),
})

export default defineEval({
  // The mistake: a server that answers isn't timed out, so the turn's status is completed.
  environment: quick,
  graders: [timedOut],
  task: async (c) => {
    await c.send(prompt)
  },
})
