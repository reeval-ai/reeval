import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { notes, trimmed } from './probes.ts'

// The agent edits a file and runs a command, and the trajectory has both: an edit of notes.txt
// (a file-edit event, or a tool call that names the file when the agent edits it from the shell)
// and a tool call whose output is what only running the command prints.

// Must fail: with no turn, the file is as the environment wrote it.
export default defineEval({
  environment: notes,
  task: async (c) => {
    assert.equal(await trimmed(c.readFile, 'notes.txt'), 'status: final')
  },
})
