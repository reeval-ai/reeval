import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, tokens } from './env.ts'

// Must fail: the agent doesn't see what the checks see.
export default defineEval({
  environment: tokens,
  graders: [observed('agent-sees-checks-value')],
  task: async (c) => {
    const turn = await c.send('print CHECK_TOKEN')
    const checksSee = (await c.exec('printf %s "$CHECK_TOKEN"')).stdout
    c.observe('agent-saw', agentSaw(turn))
    c.observe('agent-sees-checks-value', agentSaw(turn) === `${checksSee}\n`)
  },
})
