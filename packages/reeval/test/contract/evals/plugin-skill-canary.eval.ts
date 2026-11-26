import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { PLUGIN_PROOF, plugged, trimmed, withFakePlugin } from './probes.ts'

// The probe plugin's skill reaches the agent and it uses it: the proof it writes is only in that
// skill. The record (host side) shows where the skill was placed, and nothing undeclared.
// Tagged so a harness that can't load plugins runs the rest with --tag '!plugin'.

// Must fail: with no turn, nothing has written the proof.
export default defineEval({
  environment: plugged,
  agents: withFakePlugin,
  tags: ['plugin'],
  task: async (c) => {
    assert.equal(await trimmed(c.readFile, 'plugin-proof.txt'), PLUGIN_PROOF)
  },
})
