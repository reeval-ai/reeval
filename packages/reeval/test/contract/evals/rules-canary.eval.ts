import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { RULES_WORD, ruled, trimmed } from './probes.ts'

// The agent reads the environment's rules (AGENTS.md or CLAUDE.md) without being told where they
// are: the codeword it writes is only in the rules.

// Must fail: with no turn, nothing has written the codeword.
export default defineEval({
  environment: ruled,
  task: async (c) => {
    assert.equal(await trimmed(c.readFile, 'codeword.txt'), RULES_WORD)
  },
})
