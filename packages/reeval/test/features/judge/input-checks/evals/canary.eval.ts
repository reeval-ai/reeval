import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: the first command isn't listed, so the judge doesn't see it.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the second check pass?', {
      name: 'second-passed',
      inputs: { checks: ['echo second'] },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = ((s as Record<string, unknown>).checks as Array<{ command: string }>).map(
            (k) => k.command,
          )
          if (isDeepStrictEqual(saw, ['echo second'])) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    await c.exec('echo first')
    await c.exec('echo second')
  },
})
