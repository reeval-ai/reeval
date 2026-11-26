import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { mac } from './env.ts'

// Must fail: no VM started on full, which was at its VM limit.
export default defineEval({
  environment: mac,
  graders: [observed<string>('pwd', (pwd) => /\/hosts\/full\/vms\//.test(pwd))],
  task: async (c) => {
    c.observe('pwd', (await c.exec('pwd')).stdout.trim())
  },
})
