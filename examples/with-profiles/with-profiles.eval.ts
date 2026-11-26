import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// No runs here, so each profile sizes it: the config's 2, pr's limit of 1, nightly's 4.
export default defineEval({
  environment: math,
  graders: [hasFile('src/math.js', /export function multiply/), succeeded('node --test')],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')
    await c.exec('node --test')
  },
})
