import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { notes, prompts, trimmed } from './probes.ts'

// A task the model has to think about, on a model of the row's that shows its thinking
// (REEVAL_CONTRACT_REASONING_MODEL): contract.test.ts checks the trajectory has the reasoning's
// text and the turn its time. Tagged so a row with no such model leaves it out with
// --tag '!reasoning'.
export default defineEval({
  environment: notes,
  agents: contractHarness(undefined, process.env.REEVAL_CONTRACT_REASONING_MODEL),
  tags: ['reasoning'],
  task: async (c) => {
    await c.send(prompts.reasoning)
    assert.equal(await trimmed(c.readFile, 'primes.txt'), '97')
  },
})
