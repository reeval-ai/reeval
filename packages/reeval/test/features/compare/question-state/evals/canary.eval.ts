import { defineEval } from 'reeval'
import { baseline, variant } from './env.ts'
import { printsOut } from './graders.ts'

export default defineEval({
  compare: { baseline: baseline, variants: [variant] },
  // The mistake: out.txt says hi, not bye.
  graders: [printsOut('bye\n')],
  questions: [
    {
      question: 'Which reply is clearer?',
      across: 'environment',
      output: true,
      turns: 'last',
      checks: ['cat out.txt'],
    },
  ],
  task: async (c) => {
    await c.send('first turn')
    await c.send('second turn')
    await c.exec('cat out.txt')
  },
})
