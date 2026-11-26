import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { docker } from 'reeval/sandbox'

// The small package in ./project, whose tests must pass before the agent starts.
const math = defineEnvironment('math', ({ directory }) => ({
  files: directory('./project'),
  setup: ['node --test'],
}))
// The same package plus the API conventions. Files merge by path; the setup steps run the
// parent's first.
const withDocs = math.extendEnvironment('math-with-docs', ({ file }) => ({
  files: { 'docs/api.md': file('./docs/api.md') },
  setup: ['test -f docs/api.md'],
}))

// A hidden test, run in a sandbox of its own once the task returns, so the agent never sees it.
const followsTheDocs = defineGrader('follows-the-docs', ({ file }) => ({
  env: docker(),
  files: ['src/**', 'package.json'],
  data: { test: file('./hidden/multiply.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('test/multiply.test.js', c.data.test as string)
    return (await c.sandbox.exec('node --test')).exitCode === 0
  },
}))

export default defineEval({
  environment: withDocs,
  graders: [followsTheDocs],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js. Follow docs/api.md.')
  },
})
