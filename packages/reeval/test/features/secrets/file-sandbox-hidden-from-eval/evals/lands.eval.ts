import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { keys } from './env.ts'

// The eval code reads a sandbox-mode secret's placeholder, never its value.
export default defineEval({
  environment: keys,
  graders: [observed<string>('API_KEY', (key) => /^reeval_secret_[0-9A-Za-z]{32}$/.test(key))],
  task: async (c) => {
    c.observe('API_KEY', process.env.API_KEY ?? null)
  },
})
