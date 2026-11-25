import { defineEnvironment, defineEval, expect } from 'reeval'

// Every attempt seeds data/users.json and checks the tests pass before the agent starts.
const users = defineEnvironment('users', ({ directory }) => ({
  files: directory('./project'),
  setup: ['node scripts/seed.mjs', { run: 'node --test', timeout: '2m' }],
}))

export default defineEval({
  environment: users,
  task: async (c) => {
    const turn = await c.send(
      'Write src/active.js. It prints how many users in data/users.json are active.',
    )

    expect((await c.exec('node src/active.js')).stdout.trim()).toBe('25')
    expect(
      turn.diff.files.map((f) => f.path),
      "setup isn't the agent's change",
    ).not.toContain('data/users.json')
  },
})
