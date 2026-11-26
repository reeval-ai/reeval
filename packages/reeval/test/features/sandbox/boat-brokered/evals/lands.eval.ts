import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, keys } from './env.ts'

// A secret with hosts reaches the agent on the VM as a placeholder; the value stays on the host.
export default defineEval({
  environment: keys,
  graders: [observed<string>('key', (key) => /^reeval_secret_[0-9A-Za-z]{32}$/.test(key))],
  task: async (c) => {
    const [key] = agentSaw(await c.send('print API_KEY'))
    c.observe('key', key ?? null)
  },
})
