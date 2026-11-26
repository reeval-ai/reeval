import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  graders: [
    hasFile('src/math.js', /export function divide/),
    succeeded('node --test'),
    // A yes/no question about the stored attempt: yes scores 1, no 0.
    judge('Would the error divide throws when b is 0 tell a caller what they did wrong?', {
      inputs: { diff: true },
    }),
  ],
  task: async (c) => {
    await c.send(
      'Add a divide(a, b) function to src/math.js. When b is 0 it throws, with a message ' +
        'that tells the caller what went wrong.',
    )
    await c.exec('node --test')
  },
})
