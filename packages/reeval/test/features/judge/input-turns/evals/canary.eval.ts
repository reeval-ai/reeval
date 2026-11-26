import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: both turns are there, not only the last.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent keep the app from turn 1?', {
      name: 'kept-the-app',
      inputs: { task: true, turns: 'all' },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = ((s as Record<string, unknown>).turns as Array<{ task: string }>).map(
            (t) => t.task,
          )
          if (isDeepStrictEqual(saw, ['write the app', 'now add tests'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    await c.send('now add tests')
  },
})
