import { defineEval } from 'reeval'
import { fakeJudge } from 'reeval/judge'
import { plain } from './env.ts'

// The turn errors and the body judges it without reading `turn.status`, so the attempt is still
// an infra error: neither c.judge() nor c.state() counts as reading the turn's status.
export default defineEval({
  environment: plain,
  judge: { model: fakeJudge() },
  task: async (c) => {
    await c.send('Reply with the word hi.')
    await c.judge('Did it reply?', { output: true })
    await c.state({ output: true })
  },
})
