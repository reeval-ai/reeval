import { defineEval } from 'reeval'
import { plain, prompt, reported } from './env.ts'

// Every turn reports its tokens: the prompt (most of it cached, from the second call on) and
// the reply.
export default defineEval({
  environment: plain,
  graders: [reported],
  task: async (c) => {
    await c.send(prompt)
    await c.send(prompt)
  },
})
