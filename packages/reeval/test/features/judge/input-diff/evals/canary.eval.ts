import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: the `!*.test.ts` pattern leaves the test file out.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent write the app?', {
      name: 'wrote-the-app',
      inputs: { files: true, diff: ['src/', '!*.test.ts'] },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = (s as Record<string, unknown>).files
          if (isDeepStrictEqual(saw, ['added src/app.ts'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
