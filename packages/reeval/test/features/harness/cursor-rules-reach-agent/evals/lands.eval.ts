import { defineEval, expect } from 'reeval'
import { houseRules, prompt } from './env.ts'

// Cursor loads the environment's rules (AGENTS.md) into its context without being told to read it.
export default defineEval({
  environment: houseRules,
  task: async (c) => {
    const turn = await c.send(prompt)
    expect(turn.text).toContain('MARMALADE')
  },
})
