import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { graders, hiddenTests } from './graders.ts'

// Graders with env run in sandboxes of their own once the task returns.
export default defineEval({
  environment: plain,
  graders: [hiddenTests('add'), ...graders],
  task: async (c) => {
    await c.send('write add')
  },
})
