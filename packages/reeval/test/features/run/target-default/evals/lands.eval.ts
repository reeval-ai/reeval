import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// No target is capability(), which only reports: its grader's 0 fails the eval, not the run.
export default defineEval({
  graders: [observed('pick', (pick) => pick === 'postgres')],
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
  },
})
