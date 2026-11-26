import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { resume } from './env.ts'

export default defineEval({
  environment: resume,
  graders: [observed('marker.txt', (marker) => marker === 'resume')],
  task: async (c) => {
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
