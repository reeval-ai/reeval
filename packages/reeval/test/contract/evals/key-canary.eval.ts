import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { planted, scan } from './probes.ts'

// After a real turn (the harness has authenticated), the harness's real key is nowhere in the
// container: no process's environment or command line, no file. The scanner gets only hashes of
// the key's forms (REEVAL_CONTRACT_KEY_TARGETS, from contract.test.ts), never the key.

// Must fail: the same scan for a value planted in the environment and a home file finds it.
export default defineEval({
  environment: planted,
  task: async (c) => {
    const found = await scan(c.exec, process.env.REEVAL_CONTRACT_PLANTED_TARGETS ?? '[]')
    assert.deepEqual(found.hits, [])
  },
})
