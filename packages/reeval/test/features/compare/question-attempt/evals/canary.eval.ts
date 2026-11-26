import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { env } from './env.ts'

export default defineEval({
  environment: env,
  // The mistake: the agent wrote hi to out.txt, not bye.
  graders: [observed<string | null>('out.txt', (text) => !!text?.includes('bye\n'))],
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
    c.observe('out.txt', await c.readFile('out.txt'))
  },
})
