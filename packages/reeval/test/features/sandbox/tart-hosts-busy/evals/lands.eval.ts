import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { mac } from './env.ts'

// full is busy, so the trial moves to free instead of failing.
export default defineEval({
  environment: mac,
  graders: [observed<string>('pwd', (pwd) => /\/hosts\/free\/vms\//.test(pwd))],
  task: async (c) => {
    c.observe('pwd', (await c.exec('pwd')).stdout.trim())
  },
})
