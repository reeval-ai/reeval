import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { KEY, plain } from './env.ts'

// The mistake: only the name is masked, so the body gets the key itself, not [REDACTED].
export default defineEval({
  cases: [{ key: KEY }],
  environment: plain,
  graders: [observed('gets-the-case-masked')],
  task: async (c, { key: id }) => {
    c.observe('gets-the-key', id === KEY)
    c.observe('gets-the-case-masked', id === '[REDACTED]')
  },
})
