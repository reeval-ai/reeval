import { defineEnvironment, defineEval, defineGrader, regression } from 'reeval'
import { succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// The agent starts from ./project: src/duration.js, with no tests.
const duration = defineEnvironment('duration', ({ directory }) => ({
  files: directory('./project'),
}))

// The agent's tests run in a sandbox of their own against src/duration.js with one bug planted:
// only the last unit counts, so '1h30m' is 30 minutes. Good tests fail on it.
const catchesTheMutant = defineGrader('catches-the-mutant', ({ file }) => ({
  env: docker(),
  required: true,
  files: ['test/**', 'package.json'],
  data: { mutant: file('./hidden/duration.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('src/duration.js', c.data.mutant as string)
    return (await c.sandbox.exec('node --test')).exitCode !== 0
  },
}))

export default defineEval({
  environment: duration,
  target: regression(1),
  graders: [succeeded('node --test'), catchesTheMutant],
  task: async (c) => {
    await c.send('Write tests for src/duration.js in test/duration.test.js.')
    await c.exec('node --test')
  },
})
