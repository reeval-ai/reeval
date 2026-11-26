import { defineEnvironment, defineEval, metric } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  runs: 5,
  target: metric(0.6),
  // required: a try without multiply scores 0, so the mean score is the share of tries that pass.
  graders: [
    hasFile('src/math.js', /export function multiply/, { required: true }),
    succeeded('node --test'),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')
    await c.exec('node --test')
  },
})
