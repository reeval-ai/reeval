import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { baseline, variant } from './env.ts'

export default defineEval({
  compare: { baseline: baseline, variants: [variant] },
  // The mistake: the agent wrote hi to out.txt, not bye.
  graders: [observed<string | null>('out.txt', (text) => !!text?.includes('bye\n'))],
  questions: [{ question: 'Which out.txt is better?', across: 'environment', diff: true }],
  task: async (c) => {
    await c.send('write out.txt')
    c.observe('out.txt', await c.readFile('out.txt'))
  },
})
