import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { crashing, firstStartMs, prompt } from './env.ts'

export default defineEval({
  // The mistake: this server exits before it answers initialize, so its start has no timing.
  environment: crashing,
  graders: [observed('start-ms', (ms) => ms !== null)],
  task: async (c) => {
    await c.send(prompt)
    c.observe('start-ms', await firstStartMs(c))
  },
})
