import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'

// The agent starts from the small package in ./project, README.md included.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  graders: [
    hasFile('src/math.js', /export function multiply/),
    succeeded('node --test'),
    // inputs is all the judge sees: the source diff, README.md whole and the tool calls.
    judge('Does README.md list every function src/math.js exports?', {
      inputs: { diff: ['src/**'], contents: ['README.md'], transcript: 'tools' },
    }),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, and list it in README.md.')
    await c.exec('node --test')
  },
})
