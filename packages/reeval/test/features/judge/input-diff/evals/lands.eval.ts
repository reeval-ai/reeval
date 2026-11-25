import { defineEval, expect } from 'reeval'
import { fakeJudge } from 'reeval/judge'
import { app } from './env.ts'

// diff's patterns narrow the judge to src/, and a later `!` pattern takes the tests back out.
export default defineEval({
  environment: app,
  task: async (c) => {
    await c.send('write the app')
    let files: unknown
    const look = fakeJudge({
      score: (state) => {
        files = state.files
        return 1
      },
    })
    await c.judge('Did the agent write the app?', {
      model: look,
      files: true,
      diff: ['src/', '!*.test.ts'],
    })
    expect(files).toEqual(['added src/app.ts'])
  },
})
