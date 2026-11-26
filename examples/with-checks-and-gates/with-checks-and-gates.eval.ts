import { defineEnvironment, defineEval, EvalError } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  // Graders: each reports on its own once the task returns, so every requirement scores.
  graders: [
    hasFile('src/math.js', /export function divide/, { name: 'exports-divide' }),
    hasFile('src/math.js', /RangeError/, { name: 'throws-a-range-error' }),
    hasFile('test/math.test.js', 'divide(', { name: 'tests-divide' }),
    succeeded('node --test', { name: 'tests-pass' }),
  ],
  task: async (c) => {
    await c.send(
      'Add divide(a, b) to src/math.js. It throws a RangeError when b is 0. ' +
        'Test both cases in test/math.test.js.',
    )

    // A task failure: the graders mean nothing if src/math.js doesn't parse, so stop here. The
    // attempt scores 0 and no grader runs.
    const parses = await c.exec('node --check src/math.js')
    if (parses.exitCode !== 0) {
      throw new EvalError({
        reason: "src/math.js doesn't parse",
        meta: { stderr: parses.stderr.slice(-500) },
      })
    }
    await c.exec('node --test')
  },
})
