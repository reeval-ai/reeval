import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// Must fail: the agent holds the placeholder, not the value.
export default defineEval({
  environment: keys,
  graders: [observed('key', (key) => key === '[REDACTED]')],
  task: async (c) => {
    const [key] = agentSaw(await c.send('send the keys'))
    c.observe('key', key ?? null)
  },
})
