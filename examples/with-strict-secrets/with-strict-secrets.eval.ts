import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// Brokered, so the config's secrets: { unbrokered: 'error' } accepts it. Without hosts, the
// plan stops. optional: true runs the eval unauthenticated when GITHUB_TOKEN isn't set.
const github = defineEnvironment('github', ({ secret }) => ({
  env: {
    GITHUB_TOKEN: secret.fromEnv('GITHUB_TOKEN', { hosts: secret.hosts.github, optional: true }),
  },
}))

export default defineEval({
  environment: github,
  graders: [succeeded('node repo.js'), observed('full-name', (name) => name === 'nodejs/node')],
  task: async (c) => {
    await c.send(
      'Write repo.js, a Node script that fetches the nodejs/node repo from the GitHub ' +
        'API with fetch and prints its full_name, sending GITHUB_TOKEN as a bearer token when it is set.',
    )

    c.observe('full-name', (await c.exec('node repo.js')).stdout.trim())
  },
})
