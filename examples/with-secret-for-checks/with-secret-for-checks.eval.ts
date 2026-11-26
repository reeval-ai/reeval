import { defineEnvironment, defineEval, defineGrader, regression } from 'reeval'
import { observed } from 'reeval/graders'

// to: 'checks' gives the token to the task's c.exec and setup steps only. optional: true runs
// the eval without it, leaving the variable out.
const e2e = defineEnvironment('e2e', ({ secret }) => ({
  env: { E2E_TOKEN: secret.fromEnv('E2E_TOKEN', { to: 'checks', optional: true }) },
}))

// c.readFile throws when the agent wrote no env.txt, so a missing file fails it too.
const agentEnv = defineGrader('agent-env', {
  files: ['env.txt'],
  required: true,
  grade: async (c) => !/^E2E_TOKEN=/m.test(await c.readFile('env.txt')),
})

export default defineEval({
  environment: e2e,
  // Every attempt must score 1, so a token in the agent's environment fails the run.
  target: regression(),
  graders: [agentEnv, observed('task-has-token')],
  task: async (c) => {
    await c.send('Run `env | sort > env.txt`, then reply with how many lines env.txt has.')

    const token = await c.exec('printenv E2E_TOKEN')
    c.observe('task-has-token', token.exitCode === (process.env.E2E_TOKEN ? 0 : 1))
  },
})
