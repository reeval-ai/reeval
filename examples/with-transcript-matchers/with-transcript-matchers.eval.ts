import { defineEnvironment, defineEval } from 'reeval'
import { ran, wrote } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  // Each reads the transcript: what the agent's tool calls did, not only what it left.
  graders: [
    wrote('src/math.js'),
    ran(/node --test|npm (test|t)\b/),
    // ran() counts the matching commands; scoring 0 calls as 1 checks the agent installed nothing.
    ran(
      { program: 'npm', args: /^(install|i|add)\b/ },
      { name: 'installed-nothing', score: (n) => (n === 0 ? 1 : 0) },
    ),
  ],
  task: async (c) => {
    await c.send(
      'Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js. ' +
        'Run the tests before you finish. Add no dependencies.',
    )
  },
})
