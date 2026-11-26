import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { docker } from 'reeval/sandbox'

const slugify = defineEnvironment('slugify', ({ directory }) => ({ files: directory('./project') }))

// Runs in a sandbox of its own once the task returns, with the agent's src/ and package.json
// copied in, so the agent never sees the test it's graded by.
const hiddenTests = defineGrader('hidden-tests', ({ file }) => ({
  env: docker(),
  files: ['src/**', 'package.json'],
  data: { test: file('./hidden/slugify.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('test/slugify.test.js', c.data.test as string)
    const run = await c.sandbox.exec('node --test --test-reporter=tap')
    return Number(/^# pass (\d+)$/m.exec(run.stdout)?.[1] ?? 0)
  },
  score: (passed) => passed / 3,
}))

export default defineEval({
  environment: slugify,
  graders: [hiddenTests],
  task: async (c) => {
    await c.send(
      'Implement slugify(text) in src/slugify.js: lower-case, words joined by single hyphens, ' +
        'punctuation dropped.',
    )
  },
})
