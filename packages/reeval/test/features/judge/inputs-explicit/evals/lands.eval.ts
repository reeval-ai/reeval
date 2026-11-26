import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// The judge is shown only the inputs the call turns on: output alone here, with no task, files or
// diff from anywhere else.
export default defineEval({
  environment: app,
  graders: [
    judge('Is the summary clear?', {
      name: 'summary-clear',
      inputs: { output: true },
      model: fakeJudge({
        score: (s) => {
          const state = s as Record<string, unknown>
          return isDeepStrictEqual(Object.keys(state), ['output']) ? 1 : 0
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
