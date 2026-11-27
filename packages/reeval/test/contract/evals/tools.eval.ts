import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { notes, prompts, trimmed } from './probes.ts'

// The edit-and-run task with `tools: ['bash']`: the edit still lands, from the shell, and
// contract.test.ts checks the trajectory calls no tool but a command. Tagged so a row whose
// harness has no tool filter leaves it out with --tag '!tools'.
export default defineEval({
  environment: notes,
  agents: contractHarness(undefined, undefined, { tools: ['bash'] }),
  tags: ['tools'],
  task: async (c) => {
    await c.send(
      `${prompts.editAndRun} If you have no file editing tool, make the change from the shell.`,
    )
    assert.equal(await trimmed(c.readFile, 'notes.txt'), 'status: final')
  },
})
