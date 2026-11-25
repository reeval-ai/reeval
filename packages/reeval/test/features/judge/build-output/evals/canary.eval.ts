import { defineEval, expect } from 'reeval'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// Must fail: the bundle's code isn't in the judge's diff.
export default defineEval({
  environment: app,
  task: async (c) => {
    await c.send('build the app')
    let diff = ''
    const look = fakeJudge({
      score: (state) => {
        diff = String(state.diff)
        return 1
      },
    })
    await c.judge('Did the agent write the app?', { model: look, diff: true })
    expect(diff).toContain('var bundle')
  },
})
