import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

export default defineEval({
  graders: [hasFile('src/sum.js', 'reduce(', { name: 'folds-with-reduce' })],
  task: async (c) => {
    await c.send('Write src/sum.js: sum(xs) adds up a list of numbers.')
  },
})
