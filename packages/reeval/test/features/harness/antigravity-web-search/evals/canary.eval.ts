import { defineEval } from 'reeval'
import { searched } from 'reeval/graders'
import { closed, prompt } from './env.ts'

// Must fail: the agent searched the web.
export default defineEval({
  environment: closed,
  graders: [searched({ name: 'no-search', score: (n) => (n === 0 ? 1 : 0) })],
  task: async (c) => {
    await c.send(prompt)
  },
})
