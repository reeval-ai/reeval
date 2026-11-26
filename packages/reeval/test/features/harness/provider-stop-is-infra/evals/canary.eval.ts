import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'

// Must fail: an outage the provider didn't word as a limit is the agent's turn failing, so c.send
// returns it.
export default defineEval({
  environment: plain,
  graders: [observed('status', (status) => status === 'completed')],
  task: async (c) => {
    const turn = await c.send('Reply with the word hi.')
    c.observe('status', turn.status)
  },
})
