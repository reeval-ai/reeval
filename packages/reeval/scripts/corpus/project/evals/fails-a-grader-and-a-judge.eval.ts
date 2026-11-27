import { defineEval } from 'reeval'
import { judge, succeeded } from 'reeval/graders'

// A grader that fails, then a judge grader that fails, in one trial.
export default defineEval({
  graders: [
    succeeded('grep -q Bonjour greet.js'),
    judge('Is greet.js perfect?', { name: 'perfect', inputs: { diff: true } }),
  ],
  task: async (c) => {
    await c.send('Write greet.js that greets in French.')
    await c.exec('grep -q Bonjour greet.js')
  },
})
