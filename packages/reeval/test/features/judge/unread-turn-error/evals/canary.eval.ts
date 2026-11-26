import { defineEval, expect } from 'reeval'
import { fakeJudge } from 'reeval/judge'
import { plain } from './env.ts'

// Must fail: the body reads `turn.status`, so the errored turn is its own to judge.
export default defineEval({
  environment: plain,
  judge: { model: fakeJudge() },
  task: async (c) => {
    const turn = await c.send('Reply with the word hi.')
    await c.judge('Did it reply?', { output: true })
    expect(turn.status).toBe('completed')
  },
})
