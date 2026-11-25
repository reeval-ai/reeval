import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send('Write src/uniq.js: uniq(xs) drops repeated items, keeping the first.')
    expect(await c.readFile('src/uniq.js'), 'dedupes with a Set').toContain('new Set(')
  },
})
