import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  tags: ['smoke'],
  graders: [hasFile('src/math.js', /export function multiply/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
  },
})
