import { defineEval, defineGrader } from 'reeval'
import { plain } from './env.ts'

const served = defineGrader('served-label', {
  grade: (c) => c.turns[0]?.model ?? null,
  score: (model) => (model === 'fake-1[effort=high]' ? 1 : 0),
})

// Must fail: the served label is medium, not the requested high.
export default defineEval({
  environment: plain,
  graders: [served],
  task: async (c) => {
    await c.send('Reply done.')
  },
})
