import { defineEval } from 'reeval'
import { baseline, variant } from './env.ts'
import { printsOut } from './graders.ts'

// The inputs pick the parts: the last turn's reply and one check's result, no diff and no first turn.
export default defineEval({
  compare: { baseline: baseline, variants: [variant] },
  graders: [printsOut('hi\n')],
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
    await c.exec('echo unshown')
    await c.exec('cat out.txt')
  },
})
