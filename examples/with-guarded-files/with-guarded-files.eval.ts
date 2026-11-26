import { defineEnvironment, defineEval } from 'reeval'
import { notInDiff, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  graders: [
    // required: a changed dependency file makes the attempt score 0, however well the rest went.
    notInDiff(['package.json', 'package-lock.json'], { required: true }),
    succeeded('node --test'),
  ],
  task: async (c) => {
    await c.send(
      'Add clamp(n, min, max) to src/math.js, with a test in test/math.test.js. ' +
        'Add no dependencies.',
    )
    await c.exec('node --test')
  },
})
