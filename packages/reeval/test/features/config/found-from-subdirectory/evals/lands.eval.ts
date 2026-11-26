import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

// Run from deep/nested/, the config's file('marker.txt') is the project root's.
export default defineEval({
  graders: [hasFile('marker.txt', 'from the project root\n')],
  task: async (c) => {
    await c.exec('true')
  },
})
