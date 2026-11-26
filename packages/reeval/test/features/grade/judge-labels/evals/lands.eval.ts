import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { readable, tone } from './graders.ts'

export default defineEval({
  environment: plain,
  graders: [readable, tone],
  task: async (c) => void (await c.send('set the answer')),
})
