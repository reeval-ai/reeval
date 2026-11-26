import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { docker } from 'reeval/sandbox'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withErrors = math.extendEnvironment('errors', ({ skill }) => ({
  skills: [skill.local('./skills/errors')],
}))

// The hidden test runs against the agent's src/ in a sandbox of its own, offline, so the agent
// never sees it.
const throwsForZero = defineGrader('throws-for-0', ({ file }) => ({
  env: docker(),
  files: ['src/**', 'package.json'],
  data: { test: file('./hidden/divide.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('test/divide.test.js', c.data.test as string)
    return (await c.sandbox.exec('node --test test/divide.test.js')).exitCode === 0
  },
}))

export default defineEval({
  compare: { control: math, variants: [withErrors] },
  questions: [
    {
      question: 'Which divide() says more clearly what went wrong when b is 0?',
      across: 'environment',
      diff: true,
    },
  ],
  graders: [throwsForZero],
  task: async (c) => {
    await c.send('Add a divide(a, b) function to src/math.js. It must throw when b is 0.')
  },
})
