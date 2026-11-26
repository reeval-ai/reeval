import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

// Must fail: the body reads `turn.status`, so the errored turn is its own to judge and fails the
// attempt as an assertion.
export default defineEval({
  environment: plain,
  graders: [observed('status', (status) => status === 'completed')],
  task: async (c) => {
    const turn = await c.send('Reply with the word hi.')
    c.observe('status', turn.status)
  },
})
