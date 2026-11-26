import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// A sandbox-mode secret reaches the agent as its value. REEVAL_FIXTURE_TOKEN is the same value.
export default defineEval({
  environment: keys,
  graders: [observed('sees-host-value')],
  task: async (c) => {
    const saw = agentSaw(await c.send('print API_KEY'))?.trim()
    c.observe('sees-host-value', saw === process.env.REEVAL_FIXTURE_TOKEN)
  },
})
