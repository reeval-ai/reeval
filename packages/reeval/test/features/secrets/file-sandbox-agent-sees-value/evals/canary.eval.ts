import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent gets the value, not a placeholder.
export default defineEval({
  environment: keys,
  graders: [observed('sees-placeholder')],
  task: async (c) => {
    const saw = agentSaw(await c.send('print API_KEY'))?.trim() ?? ''
    c.observe('agent-saw', saw)
    c.observe('sees-placeholder', /^reeval_secret_/.test(saw))
  },
})
