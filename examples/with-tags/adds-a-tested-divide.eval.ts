import { defineEnvironment, defineEval, expect } from 'reeval'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  tags: ['slow'],
  task: async (c) => {
    await c.send(
      'Add divide(a, b) to src/math.js. It throws a RangeError when b is 0. Test it in test/math.test.js.',
    )

    await expect(c).toHaveFile('src/math.js', /export function divide/)
    await expect(c.exec('node --test')).toSucceed()
  },
})
