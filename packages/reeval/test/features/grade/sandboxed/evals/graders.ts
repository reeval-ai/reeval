import { defineGrader } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const onDocker = process.env.REEVAL_FIXTURE_SANDBOX === 'docker'

// Each grader's own sandbox: deny-all in Docker; the fake sandbox enforces no egress.
const env = onDocker
  ? { env: docker() }
  : {
      env: fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) }),
      egress: 'allow-all' as const,
    }

// Runs a hidden test file from the host against the kept src/ in a fresh sandbox.
export const hiddenTests = (name: string) =>
  defineGrader(`hidden-${name}`, ({ file }) => ({
    ...env,
    files: ['src/**', 'package.json'],
    data: { test: file(`../hidden/${name}.test.js`) },
    grade: async (c) => {
      await c.sandbox.writeFile('test/hidden.test.js', c.data.test as string)
      // The fake sandbox inherits the host's environment, where a parent `node --test`
      // sets NODE_TEST_CONTEXT and a nested one then skips its files.
      const run = await c.sandbox.exec(
        'env -u NODE_TEST_CONTEXT node --test --test-reporter=tap test/hidden.test.js',
      )
      return Number(/^# pass (\d+)$/m.exec(run.stdout)?.[1] ?? 0)
    },
    score: (passed) => passed / 2,
  }))

// Only the files it names are copied in.
export const scoped = defineGrader('scoped', {
  ...env,
  files: ['src/**'],
  grade: async (c) =>
    (await c.sandbox.readFile('src/add.js')) !== null &&
    (await c.sandbox.readFile('notes.txt')) === null,
})

// deny-all: a fetch from the grader's sandbox fails.
export const offline = defineGrader('offline', {
  ...env,
  grade: async (c) =>
    (
      await c.sandbox.exec(
        `node -e "fetch('https://registry.npmjs.org').then(() => process.exit(0), () => process.exit(3))"`,
      )
    ).exitCode,
  score: (code) => (code === 3 ? 1 : 0),
})

export const graders = onDocker ? [scoped, offline] : [scoped]
