import { defineEnvironment, defineEval, expect, metric } from 'reeval'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  runs: 3,
  target: metric(0.75),
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')

    await expect(c, 'exports multiply').toHaveFile('src/math.js', /export function multiply/)
    await expect(c.exec('node --test'), 'tests pass').toSucceed()
  },
})
