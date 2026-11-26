import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: 'tools' leaves the reasoning out.
export default defineEval({
  environment: app,
  graders: [
    judge('Did the agent run the tests?', {
      name: 'ran-the-tests',
      inputs: { trajectory: 'tools' },
      model: fakeJudge({
        // 0 only on the wrong value it's known to see; anything else errors the grader.
        score: (s) => {
          const saw = String((s as Record<string, unknown>).trajectory)
          if (/^tool shell: npm test → ok/m.test(saw) && !saw.includes('thinking it over')) return 0
          throw new Error(`the judge saw ${JSON.stringify(saw)}`)
        },
      }),
    }),
  ],
  task: async (c) => {
    await c.send('write the app')
  },
})
