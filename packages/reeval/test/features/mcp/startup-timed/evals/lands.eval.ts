import { defineEval, expect } from 'reeval'
import { firstStartMs, prompt, stamp } from './env.ts'

// The agent started the stdio server through reeval's timer, which logged its initialize answer.
export default defineEval({
  environment: stamp,
  task: async (c) => {
    await c.send(prompt)
    expect(await firstStartMs(c)).not.toBeNull()
  },
})
