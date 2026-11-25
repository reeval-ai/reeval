import { defineEval } from 'reeval'
import { typo } from './env.ts'

// `only` naming a skill the source doesn't have is an infra error that names it and lists what
// the source has (features.test.ts checks the message); the eval body never runs.
export default defineEval({
  environment: typo,
  task: async (c) => {
    await c.exec('true')
    throw new Error('the eval body ran with a skill missing from only')
  },
})
