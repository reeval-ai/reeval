import { defineEval, expect } from 'reeval'
import { KEY, plain } from './env.ts'

export default defineEval({
  environment: plain,
  cases: [{ id: KEY }],
  task: async (_c, { id }) => {
    // The mistake: only the name is masked, so the body gets the key itself, not [REDACTED].
    expect(id, 'gets the case masked').toBe('[REDACTED]')
  },
})
