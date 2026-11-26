import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { closed } from './env.ts'

// Must fail: expecting a host doesn't let it through.
export default defineEval({
  environment: closed,
  graders: [hasFile('reached.txt', /^200 \d{3}$/)],
  task: async (c) => {
    await c.send('call home')
  },
})
