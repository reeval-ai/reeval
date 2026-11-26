import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: the `!**/*.test.ts` pattern leaves the test file out.
export default defineEval({
  environment: app,
  graders: [
    judge('Is the app tidy?', {
      name: 'tidy',
      inputs: { contents: ['src/**', '!**/*.test.ts', 'docs/**'] },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = Object.keys((s as Record<string, unknown>).contents ?? {})
          if (isDeepStrictEqual(saw, ['src/app.ts', 'src/util.ts'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
