import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: the same grader under the config's regression() fails the attempt.
export default defineEval({
  graders: [observed('pick', (pick) => pick === 'postgres')],
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
  },
})
