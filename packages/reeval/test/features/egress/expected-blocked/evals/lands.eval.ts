import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { closed } from './env.ts'

// An expected host is still refused at CONNECT; only how reeval reports it changes.
export default defineEval({
  environment: closed,
  graders: [hasFile('reached.txt', /^403 000$/)],
  task: async (c) => {
    await c.send('call home')
  },
})
