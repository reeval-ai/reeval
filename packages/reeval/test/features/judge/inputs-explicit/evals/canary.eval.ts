import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: nothing adds the task, the changed files or the diff to an output-only call.
export default defineEval({
  environment: app,
  graders: [
    judge('Is the summary clear?', {
      name: 'summary-clear',
      inputs: { output: true },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = Object.keys(s as Record<string, unknown>)
          if (isDeepStrictEqual(saw, ['output'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
