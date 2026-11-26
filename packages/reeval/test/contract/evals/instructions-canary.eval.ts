import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { OPTION_WORD, prompts, ruled, trimmed } from './probes.ts'

// The harness's `instructions` reach the model, added to its own prompt: the codeword it writes is
// only in them.

// Must fail: the same turn without the instructions can't know the codeword (the house rules have
// another one).
export default defineEval({
  environment: ruled,
  tags: ['instructions'],
  task: async (c) => {
    await c.send(prompts.option)
    assert.equal(await trimmed(c.readFile, 'codeword.txt'), OPTION_WORD)
  },
})
