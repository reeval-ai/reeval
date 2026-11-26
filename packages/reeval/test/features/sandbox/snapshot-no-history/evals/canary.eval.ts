import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, seeded } from './env.ts'

// Wrong: no snapshot the agent can reach keeps the seeded file as it was before the placement.
export default defineEval({
  environment: seeded,
  graders: [observed('probe', (probe) => probe !== 'pre-seed content in: nowhere')],
  task: async (c) => {
    await c.send('Make a change.')
    await c.writeFile('src/sum.js', 'export const sum = (a, b) => a - b\n')
    const t2 = await c.send('Report.')
    const [probe] = agentSaw(t2)
    c.observe('probe', probe?.trim() ?? null)
  },
})
