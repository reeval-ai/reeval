import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { OPTION_WORD, optionRule, prompts, ruled, trimmed } from './probes.ts'

// The harness's `instructions` reach the model, added to its own prompt: the codeword it writes is
// only in them. Tagged so a row whose harness takes none leaves it out with --tag '!instructions'.
export default defineEval({
  environment: ruled,
  agents: contractHarness(undefined, undefined, { instructions: optionRule }),
  tags: ['instructions'],
  task: async (c) => {
    await c.send(prompts.option)
    assert.equal(await trimmed(c.readFile, 'codeword.txt'), OPTION_WORD)
  },
})
