import { defineEnvironment, defineEval, expect } from 'reeval'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  task: async (c) => {
    const turn = await c.send(
      'Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js. ' +
        'Run the tests before you finish. Add no dependencies.',
    )

    expect(turn, 'edited math.js').toHaveEdited('src/math.js')
    expect(turn, 'ran the tests').toHaveRun(/node --test|npm (test|t)\b/)
    expect(turn, 'installed nothing').not.toHaveRun({
      program: 'npm',
      args: /^(install|i|add)\b/,
    })
  },
})
