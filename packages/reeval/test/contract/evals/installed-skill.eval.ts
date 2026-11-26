import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { INSTALLED_PROOF, installed, prompts, trimmed, withFakeInstalled } from './probes.ts'

// A skill a setup step installed, not the environment's `skills`, is the agent's to use: the
// proof it writes is only in the skill. The record check (host side) counts the use in skill_reads.
export default defineEval({
  environment: installed,
  agents: withFakeInstalled,
  task: async (c) => {
    await c.send(prompts.installed)
    assert.equal(await trimmed(c.readFile, 'installed-proof.txt'), INSTALLED_PROOF)
  },
})
