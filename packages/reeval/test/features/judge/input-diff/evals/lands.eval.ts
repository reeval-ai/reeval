import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// diff's patterns narrow the judge to src/, and a later `!` pattern takes the tests back out.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent write the app?', {
      name: 'wrote-the-app',
      inputs: { files: true, diff: ['src/', '!*.test.ts'] },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return isDeepStrictEqual(state.files, ['added src/app.ts']) ? 1 : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
