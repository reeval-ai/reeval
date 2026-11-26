import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, observed } from 'reeval/graders'

// to: 'checks' gives the token to the task's c.exec and setup steps only. optional: true runs
// the eval without it, leaving the variable out.
const e2e = defineEnvironment('e2e', ({ secret }) => ({
  env: { E2E_TOKEN: secret.fromEnv('E2E_TOKEN', { to: 'checks', optional: true }) },
}))

export default defineEval({
  environment: e2e,
  graders: [
    // hasFile() is true when env.txt lists the token: scoring that 0 checks the agent never had it.
    hasFile('env.txt', /^E2E_TOKEN=/m, { name: 'agent-env', score: (listed) => (listed ? 0 : 1) }),
    observed('task-has-token'),
  ],
  task: async (c) => {
    await c.send('Run `env | sort > env.txt`, then reply with how many lines env.txt has.')

    const token = await c.exec('printenv E2E_TOKEN')
    c.observe('task-has-token', token.exitCode === (process.env.E2E_TOKEN ? 0 : 1))
  },
})
