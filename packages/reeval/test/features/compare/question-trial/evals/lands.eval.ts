import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { env } from './env.ts'

// A question with no across is asked of each trial as it ends, shown the inputs it turns on.
export default defineEval({
  environment: env,
  graders: [hasFile('out.txt', 'hi\n')],
  questions: [
    {
      question: 'Did it write out.txt?',
      choices: ['yes', 'no'],
      task: true,
      output: true,
      diff: true,
      trajectory: true,
    },
  ],
  task: async (c) => {
    await c.send('write out.txt')
  },
})
