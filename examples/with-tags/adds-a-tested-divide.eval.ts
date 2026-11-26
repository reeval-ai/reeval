import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  tags: ['slow'],
  graders: [hasFile('src/math.js', /export function divide/), succeeded('node --test')],
  task: async (c) => {
    await c.send(
      'Add divide(a, b) to src/math.js. It throws a RangeError when b is 0. Test it in test/math.test.js.',
    )
    await c.exec('node --test')
  },
})
