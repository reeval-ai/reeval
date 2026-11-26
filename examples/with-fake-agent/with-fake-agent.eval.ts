import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { succeeded } from 'reeval/graders'
import { ran, wrote } from 'reeval/graders/match'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// What each turn's tool calls did: the first edits src/math.js, the second runs the tests.
const editsThenTests = defineGrader('edits-then-tests', {
  grade: ({ turns }) =>
    wrote({ turns: turns.slice(0, 1) }, 'src/math.js').length > 0 &&
    ran({ turns: turns.slice(1, 2) }, /node --test|npm (test|t)\b/) > 0,
})

export default defineEval({
  environment: math,
  graders: [editsThenTests, succeeded('node --test')],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test.')
    await c.send('Now run the tests and tell me whether they pass.')
    await c.exec('node --test')
  },
})
