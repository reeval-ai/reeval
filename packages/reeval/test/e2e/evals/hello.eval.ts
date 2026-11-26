import assert from 'node:assert/strict'
import { defineEval } from 'reeval'

// One short turn with a check on the file it writes, so two runs of it are "same" in reeval compare.
// A trailing period is allowed: the check is that the agent wrote the file, not its punctuation.
export default defineEval({
  task: async (c) => {
    await c.send(
      'Create a file named hello.txt whose only content is `hello from reeval`, then stop.',
    )
    assert.match((await c.readFile('hello.txt'))?.trim(), /^hello from reeval\.?$/)
  },
})
