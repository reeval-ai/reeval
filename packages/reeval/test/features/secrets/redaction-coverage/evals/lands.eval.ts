import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { forms, leaky } from './env.ts'

// The agent leaks the secret in every form, and the judge reads it all, writing what it was sent
// to judge-saw.json; the oracle then checks that none of the forms reached it, the record, the
// history folder or what the studio serves.
export default defineEval({
  environment: leaky,
  graders: [
    judge('Did the agent print the token?', {
      name: 'printed',
      inputs: { task: true, output: true, files: true, diff: true },
      model: fakeJudge({
        score: (state) => {
          writeFileSync(new URL('../judge-saw.json', import.meta.url), JSON.stringify(state))
          return 1
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('print LEAKY_TOKEN every way you can')
    const leaked = (await c.readFile('leak.txt'))?.split('\n')
    assert.deepEqual(leaked, forms(process.env.REEVAL_FIXTURE_LEAKY ?? ''))
  },
})
