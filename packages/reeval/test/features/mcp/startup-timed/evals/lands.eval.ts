import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { firstStartMs, prompt, stamp } from './env.ts'

// The agent started the stdio server through reeval's timer, which logged its initialize answer.
export default defineEval({
  environment: stamp,
  graders: [observed('start-ms', (ms) => ms !== null)],
  task: async (c) => {
    await c.send(prompt)
    c.observe('start-ms', await firstStartMs(c))
  },
})
