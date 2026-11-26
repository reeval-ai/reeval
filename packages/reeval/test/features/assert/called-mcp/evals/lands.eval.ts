import { defineEval } from 'reeval'
import { calledMcp } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [calledMcp('stamp', 'house_stamp')],
  task: async (c) => {
    await c.send('call house_stamp')
  },
})
