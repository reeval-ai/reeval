import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: files isn't listed, so the judge doesn't see it.
export default defineEval({
  environment: app,
  graders: [
    judge('Did it pick drizzle?', {
      name: 'picked-drizzle',
      inputs: { observations: ['orm'] },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = (s as Record<string, unknown>).observations
          if (isDeepStrictEqual(saw, { orm: 'drizzle' })) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
    c.observe('orm', 'drizzle')
    c.observe('files', 1)
  },
})
