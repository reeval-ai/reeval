import { defineEval, regression } from 'reeval'
import { observed } from 'reeval/graders'

// Must fail: the same grader under regression() fails the run.
export default defineEval({
  target: regression(),
  graders: [observed('pick', (pick) => pick === 'postgres')],
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
  },
})
