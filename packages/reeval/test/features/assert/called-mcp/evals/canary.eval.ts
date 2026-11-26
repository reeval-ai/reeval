import { defineEval } from 'reeval'
import { calledMcp } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent called house_stamp, not other.
  graders: [calledMcp('stamp', 'other')],
  task: async (c) => {
    await c.send('call house_stamp')
  },
})
