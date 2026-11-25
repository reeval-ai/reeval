import { defineEval, expect } from 'reeval'

export default defineEval({
  task: async (c) => {
    await c.send('Write src/sum.js: sum(xs) adds up a list of numbers.')
    expect(await c.readFile('src/sum.js'), 'folds with reduce').toContain('reduce(')
  },
})
