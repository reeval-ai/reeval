import { defineEval } from 'reeval'
import { plain } from './env.ts'

// A turn the eval's timeout cuts off is recorded as aborted, not completed (features.test.ts
// checks the record).
export default defineEval({
  environment: plain,
  timeout: '4s',
  task: async (c) => {
    await c.send('Run `sleep 30` in the shell, then reply with the word done.')
  },
})
