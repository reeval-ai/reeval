import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: the bundle's code isn't in the judge's diff.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent write the app?', {
      name: 'wrote-the-app',
      inputs: { diff: true },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = String((s as Record<string, unknown>).diff)
          if (
            saw.includes('[reeval: dropped public/vendor.js: minified') &&
            !saw.includes('var bundle')
          )
            return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('build the app')
  },
})
