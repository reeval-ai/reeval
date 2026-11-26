import { defineEval, expect } from 'reeval'
import { answering, app, questions } from './env.ts'

// The mistake: this model answers, so the call doesn't fail and the attempt is the task's own.
export default defineEval({
  environment: app,
  task: async (c) => {
    await c.send('write the app')
    const answered = await c
      .decide({ model: answering, state: c.state({ diff: true }), questions })
      .then(() => true)
      .catch(() => false)
    expect(answered).toBe(false)
  },
})
