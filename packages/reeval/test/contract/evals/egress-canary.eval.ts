import { defineEval, expect } from 'reeval'
import { BLOCKED_HOST, closed, reach, trimmed } from './probes.ts'

// Under deny-all the harness's automatic hosts stay open, so the agent works; any other host is
// refused at CONNECT (403). contract.test.ts checks the record: the refusal and the API reached.

// Must fail: the blocked host is refused without a turn too, so it never answers 200.
export default defineEval({
  environment: closed,
  tags: ['egress'],
  task: async (c) => {
    await c.exec(`${reach(BLOCKED_HOST)} || true`)
    expect(await trimmed(c.readFile, 'blocked.txt')).toMatch(/^200 /)
  },
})
