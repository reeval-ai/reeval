import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, observed, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// deny-all still lets through what the attempt needs: the harness's API, brokered secrets'
// hosts and MCP servers' hosts. Every other request gets a 403 from the gateway and is recorded.
export default defineEval({
  environment: math,
  egress: 'deny-all',
  graders: [
    hasFile('src/math.js', /export function multiply/),
    succeeded('node --test'),
    observed('offline'),
  ],
  task: async (c) => {
    await c.send(
      'Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js. ' +
        'Use no packages from npm.',
    )

    await c.exec('node --test')
    c.observe('offline', (await c.exec('curl -sS https://registry.npmjs.org/')).exitCode !== 0)
  },
})
