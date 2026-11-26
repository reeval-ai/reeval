import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent doesn't get the host value.
export default defineEval({
  environment: keys,
  graders: [observed('key-is-host-value')],
  task: async (c) => {
    const [key] = agentSaw(await c.send('print API_KEY'))
    c.observe('agent-saw', key)
    c.observe('key-is-host-value', key === process.env.REEVAL_FIXTURE_TOKEN)
  },
})
