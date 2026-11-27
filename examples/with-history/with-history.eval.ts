import { defineEnvironment, defineEval, regression } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  // Every trial must score 1, so a broken run fails and `reeval compare` can call it a regression.
  target: regression(1),
  graders: [hasFile('src/math.js', /export function multiply/), succeeded('node --test')],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')
    await c.exec('node --test')
  },
})
