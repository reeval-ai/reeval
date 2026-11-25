import { defineEval, expect } from 'reeval'
import { prompts, RULES_WORD, ruled, trimmed } from './probes.ts'

// The agent reads the environment's rules (AGENTS.md or CLAUDE.md) without being told where they
// are: the codeword it writes is only in the rules.
export default defineEval({
  environment: ruled,
  task: async (c) => {
    await c.send(prompts.rules)
    expect(await trimmed(c.readFile, 'codeword.txt')).toBe(RULES_WORD)
  },
})
