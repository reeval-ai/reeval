import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// sindresorhus/camelcase at a release tag: no dependencies, and node --test runs its own tests.
const camelcase = defineEnvironment('camelcase', ({ git }) => ({
  workspace: git('github:sindresorhus/camelcase', { ref: 'v10.0.0', init: true }),
}))

// The hidden test runs against the agent's index.js in a sandbox of its own, offline, so the
// agent never sees it.
const separators = defineGrader('separators-work', ({ file }) => ({
  env: docker(),
  required: true,
  files: ['index.js', 'package.json'],
  data: { test: file('./hidden/separators.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('separators.test.js', c.data.test as string)
    return (await c.sandbox.exec('node --test separators.test.js')).exitCode === 0
  },
}))

export default defineEval({
  environment: camelcase,
  graders: [succeeded('node --test'), hasFile('readme.md', /separators/), separators],
  task: async (c) => {
    await c.send(
      'Add a separators option to camelCase: a string of extra characters that also separate ' +
        "words, so camelCase('foo/bar', {separators: '/'}) is 'fooBar'. Add tests to test.js and " +
        'document it in readme.md. Run the tests with node --test.',
    )
    await c.exec('node --test')
  },
})
