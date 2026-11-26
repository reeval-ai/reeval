import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { KEY, plain } from './env.ts'

// The case's key names the eval, which is recorded and shown masked; the body gets the case as is.
export default defineEval({
  cases: [{ key: KEY }],
  environment: plain,
  graders: [observed('gets-the-case-as-written')],
  task: async (c, { key: id }) => {
    c.observe('gets-the-case-as-written', id === KEY)
  },
})
