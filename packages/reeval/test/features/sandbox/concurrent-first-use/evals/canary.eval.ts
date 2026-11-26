import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { notes } from './env.ts'

// Must fail: the marker holds what c.writeFile wrote, not the agent's notes.
export default defineEval({
  environment: notes,
  graders: [observed('marker.txt', (marker) => marker === 'from the agent\n')],
  task: async (c) => {
    await Promise.all([
      c.writeFile('marker.txt', 'written'),
      c.exec('test -f notes.txt'),
      c.readFile('notes.txt'),
    ])
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
