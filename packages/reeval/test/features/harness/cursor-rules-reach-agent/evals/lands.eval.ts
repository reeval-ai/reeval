import { defineEval } from 'reeval'
import { houseRules, prompt, said } from './env.ts'

// Cursor loads the environment's rules (AGENTS.md) into its context without being told to read it.
export default defineEval({
  environment: houseRules,
  graders: [said],
  task: async (c) => {
    await c.send(prompt)
  },
})
