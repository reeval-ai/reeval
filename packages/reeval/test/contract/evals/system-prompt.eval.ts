import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { notes, OPTION_WORD, prompts, replacedPrompt, trimmed } from './probes.ts'

// The edit-and-run task with `systemPrompt` in place of the harness's own prompt: the codeword it
// writes is only in the replacement, and contract.test.ts checks its first model call was smaller
// than the edit-and-run trial's, which carried the harness's own prompt. Tagged so a row whose
// harness can't replace it leaves it out with --tag '!system-prompt'.
export default defineEval({
  environment: notes,
  agents: contractHarness(undefined, undefined, { systemPrompt: replacedPrompt }),
  tags: ['system-prompt'],
  task: async (c) => {
    await c.send(prompts.systemPrompt)
    assert.equal(await trimmed(c.readFile, 'codeword.txt'), OPTION_WORD)
    assert.equal(await trimmed(c.readFile, 'notes.txt'), 'status: final')
  },
})
