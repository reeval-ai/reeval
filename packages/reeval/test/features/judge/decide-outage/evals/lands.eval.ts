import { defineEval } from 'reeval'
import { app, outage, questions } from './env.ts'

// A decision the provider never answered fails the trial as an infra error, even when the
// task catches it (features.test.ts checks the record), so --retry-errors runs it again.
export default defineEval({
  environment: app,
  task: async (c) => {
    await c.send('write the app')
    await c.decide({ model: outage, state: c.state({ diff: true }), questions }).catch(() => {})
  },
})
