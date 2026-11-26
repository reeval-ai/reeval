import { defineEval } from 'reeval'
import { noRules, prompt, said } from './env.ts'

// Must fail: without the rules, the agent can't know the word.
export default defineEval({
  environment: noRules,
  graders: [said],
  task: async (c) => {
    await c.send(prompt)
  },
})
