import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { INSTALLED_PROOF, installed, trimmed } from './probes.ts'

// A skill a setup step installed, not the environment's `skills`, is the agent's to use: the
// proof it writes is only in the skill. The record check (host side) counts the use in skill_reads.

// Must fail: with no turn, nothing has written the proof.
export default defineEval({
  environment: installed,
  task: async (c) => {
    assert.equal(await trimmed(c.readFile, 'installed-proof.txt'), INSTALLED_PROOF)
  },
})
