import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// jq is baked onto reeval's image once, and the image is cached by the exact command list.
const withJq = defineEnvironment('jq', ({ directory }) => ({
  files: directory('./project'),
  sandbox: docker({
    install: [
      'apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*',
    ],
  }),
}))

export default defineEval({
  environment: withJq,
  graders: [succeeded('jq --version'), observed('count', (count) => count === '2')],
  task: async (c) => {
    await c.send(
      'Write count.sh, a bash script that prints how many orders in orders.json have a total over 100, using jq.',
    )

    await c.exec('jq --version')
    c.observe('count', (await c.exec('bash count.sh')).stdout.trim())
  },
})
