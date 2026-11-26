import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// The agent starts from ./project, where findUser() puts the name straight into its SQL.
const users = defineEnvironment('users', ({ directory }) => ({ files: directory('./project') }))

// The exploit runs against the agent's src/ in a sandbox of its own, offline, so the agent never
// sees it. The repo's tests pass on the vulnerable code, so an unblocked exploit scores 0.
const blocksTheExploit = defineGrader('blocks-the-exploit', ({ file }) => ({
  env: docker(),
  required: true,
  files: ['src/**', 'package.json'],
  data: { exploit: file('./hidden/exploit.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('test/exploit.test.js', c.data.exploit as string)
    const { exitCode, stdout } = await c.sandbox.exec(
      'node --test --test-reporter=tap test/exploit.test.js',
    )
    return { exitCode, failed: stdout.split('\n').filter((line) => line.startsWith('not ok')) }
  },
  score: (grade) => (grade.exitCode === 0 ? 1 : 0),
}))

export default defineEval({
  environment: users,
  graders: [succeeded('node --test'), blocksTheExploit],
  task: async (c) => {
    await c.send('findUser() in src/users.js is open to SQL injection. Fix it.')
    await c.exec('node --test')
  },
})
