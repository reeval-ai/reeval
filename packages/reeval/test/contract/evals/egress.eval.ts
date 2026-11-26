import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { closed, prompts, trimmed } from './probes.ts'

// Under deny-all the harness's automatic hosts stay open, so the agent works; any other host is
// refused at CONNECT (403). contract.test.ts checks the record: the refusal and the API reached.
export default defineEval({
  environment: closed,
  tags: ['egress'],
  task: async (c) => {
    const turn = await c.send(prompts.egress)
    assert.equal(turn.status, 'completed')
    assert.match(await trimmed(c.readFile, 'blocked.txt'), /^403 /)
  },
})
