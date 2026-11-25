import { defineEval, expect } from 'reeval'
import { env } from './env.ts'

// A question with no across is asked of each attempt as it ends, shown the inputs it turns on.
export default defineEval({
  environment: env,
  questions: [
    {
      question: 'Did it write out.txt?',
      choices: ['yes', 'no'],
      task: true,
      output: true,
      diff: true,
      transcript: true,
    },
  ],
  task: async (c) => {
    await c.send('write out.txt')
    expect(await c.readFile('out.txt')).toBe('hi\n')
  },
})
