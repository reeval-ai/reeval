import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'

// The turn errors and the body never reads `turn.status`, so although its check holds the
// trial is an infra error (features.test.ts checks the record and the exit code).
export default defineEval({
  environment: plain,
  graders: [succeeded('true')],
  task: async (c) => {
    await c.send('Reply with the word hi.')
    await c.exec('true')
  },
})
