import { defineEval, metric } from 'reeval'
import { observed } from 'reeval/graders'

// target: metric() records the pick and gates nothing: its grader's 0 leaves it `ran`, not failed.
export default defineEval({
  target: metric(),
  graders: [observed('pick', (pick) => pick === 'postgres')],
  task: async (c) => {
    c.observe('pick', await c.readFile('pick.txt'))
  },
})
