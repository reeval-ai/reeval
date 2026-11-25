import { defineEval, expect } from 'reeval'
import { notes } from './env.ts'

// First calls made at once share one start: what one wrote, the others' sandbox has.
export default defineEval({
  environment: notes,
  task: async (c) => {
    await Promise.all([
      c.writeFile('marker.txt', 'written'),
      c.exec('test -f notes.txt'),
      c.readFile('notes.txt'),
    ])
    expect(await c.readFile('marker.txt')).toBe('written')
  },
})
