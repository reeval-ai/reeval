import { defineEval, expect } from 'reeval'
import { houseRules } from './env.ts'

// Must fail: rules go to AGENTS.md, not Claude's CLAUDE.md.
export default defineEval({
  environment: houseRules,
  task: async (c) => {
    expect(await c.readFile('CLAUDE.md')).toBe('Always write tests.')
  },
})
