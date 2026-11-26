import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { resume } from './env.ts'

// Must fail: the leftover staging is the same run, not a new one with a different marker.
export default defineEval({
  environment: resume,
  graders: [observed('marker.txt', (marker) => marker === 'new-run')],
  task: async (c) => {
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
