import { defineEnvironment, defineEval, expect } from 'reeval'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  task: async (c) => {
    await c.send(
      'Add clamp(n, min, max) to src/math.js, with a test in test/math.test.js. ' +
        'Add no dependencies.',
    )

    expect(c, 'dependencies untouched').not.toHaveChanged(['package.json', 'package-lock.json'])
    await expect(c.exec('node --test'), 'tests pass').toSucceed()
  },
})
