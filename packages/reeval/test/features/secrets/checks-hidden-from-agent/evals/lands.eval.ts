import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, tokens } from './env.ts'

// A `to: 'checks'` secret isn't in the agent's environment.
export default defineEval({
  environment: tokens,
  graders: [observed('agent-saw', (saw) => saw === 'unset\n')],
  task: async (c) => {
    const turn = await c.send('print CHECK_TOKEN')
    c.observe('agent-saw', agentSaw(turn) ?? null)
  },
})
