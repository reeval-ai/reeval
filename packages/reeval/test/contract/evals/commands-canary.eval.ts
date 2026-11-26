import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { notes, prompts } from './probes.ts'

// `commands` holds the shell to its list: of the two commands the agent runs, only the listed one
// does anything.

// Must fail: with `tools: ['bash']` but no `commands`, both commands run.
export default defineEval({
  environment: notes,
  agents: contractHarness(undefined, undefined, { tools: ['bash'] }),
  tags: ['commands'],
  task: async (c) => {
    await c.send(prompts.commands)
    assert.equal(await c.readFile('allowed.txt'), '', 'the allowed command ran')
    assert.equal(await c.readFile('denied.txt'), null, 'the denied command ran')
  },
})
