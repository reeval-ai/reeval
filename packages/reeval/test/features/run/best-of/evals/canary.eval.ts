import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: every attempt scores the wrong word, so the first two agree and the third never runs.
export default defineEval({
  runs: { bestOf: 3 },
  graders: [observed('word', (word) => word === 'hello')],
  task: async (c) => {
    c.observe('word', await c.readFile('word.txt'))
  },
})
