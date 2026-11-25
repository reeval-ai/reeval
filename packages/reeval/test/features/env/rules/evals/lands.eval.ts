import { defineEval, expect } from 'reeval'
import { houseRules } from './env.ts'

// `rules` become the workspace's AGENTS.md, word for word.
export default defineEval({
  environment: houseRules,
  task: async (c) => {
    expect(await c.readFile('AGENTS.md')).toBe('Always write tests.')
  },
})
