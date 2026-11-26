import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { exportsAnswer } from './graders.ts'

export default defineEval({
  environment: plain,
  graders: [exportsAnswer],
  task: async (c) => void (await c.send('set the answer')),
})
