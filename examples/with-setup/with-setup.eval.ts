import { defineEnvironment, defineEval } from 'reeval'
import { notInDiff, observed } from 'reeval/graders'

// Every trial seeds data/users.json and checks the tests pass before the agent starts.
const users = defineEnvironment('users', ({ directory }) => ({
  files: directory('./project'),
  setup: ['node scripts/seed.mjs', { run: 'node --test', timeout: '2m' }],
}))

export default defineEval({
  environment: users,
  graders: [
    observed('active', (count) => count === '25'),
    // The diff starts after setup, so the seeded file isn't the agent's change.
    notInDiff('data/users.json', { name: 'setup-is-not-the-change' }),
  ],
  task: async (c) => {
    await c.send('Write src/active.js. It prints how many users in data/users.json are active.')
    c.observe('active', (await c.exec('node src/active.js')).stdout.trim())
  },
})
