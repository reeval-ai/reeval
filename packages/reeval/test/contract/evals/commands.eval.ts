import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { contractHarness } from '../harness.ts'
import { ALLOWED_COMMAND, notes, prompts } from './probes.ts'

// `commands` holds the shell to its list: of the two commands the agent runs, only the listed one
// does anything. `tools: ['bash']` too, so no file tool can write denied.txt. Tagged so a row
// whose harness can't hold commands to a list leaves it out with --tag '!commands'.
export default defineEval({
  environment: notes,
  agents: contractHarness(undefined, undefined, { tools: ['bash'], commands: [ALLOWED_COMMAND] }),
  tags: ['commands'],
  task: async (c) => {
    await c.send(prompts.commands)
    assert.equal(await c.readFile('allowed.txt'), '', 'the allowed command ran')
    assert.equal(await c.readFile('denied.txt'), null, 'the denied command ran')
  },
})
