import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { notes } from './env.ts'

// First calls made at once share one start: what one wrote, the others' sandbox has.
export default defineEval({
  environment: notes,
  graders: [observed('marker.txt', (marker) => marker === 'written')],
  task: async (c) => {
    await Promise.all([
      c.writeFile('marker.txt', 'written'),
      c.exec('test -f notes.txt'),
      c.readFile('notes.txt'),
    ])
    c.observe('marker.txt', await c.readFile('marker.txt'))
  },
})
