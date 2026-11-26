import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { archived } from './env.ts'

export default defineEval({
  environment: archived,
  graders: [hasFile('marker.txt')],
  task: async (c) => {
    await c.send('look for the marker')
  },
})
