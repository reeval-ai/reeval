import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'

// The sandbox's variables: the agent, setup and the task's commands all see them. The child keeps
// NODE_ENV and replaces CURRENCY, since env merges by name.
const shop = defineEnvironment('shop', ({ directory }) => ({
  files: directory('./project'),
  env: { NODE_ENV: 'test', CURRENCY: 'USD' },
}))
const shopInEuros = shop.extendEnvironment('shop-eur', { env: { CURRENCY: 'EUR' } })

const prompt = 'Make price() in src/price.js use the currency in the CURRENCY environment variable.'

export default defineEval({
  environment: shopInEuros,
  graders: [
    observed('price', (out) => out === 'EUR 12.50\n'),
    observed('node-env', (out) => out === 'test\n', { name: 'keeps-node-env' }),
    succeeded('node --test'),
  ],
  task: async (c) => {
    await c.send(prompt)

    c.observe('price', (await c.exec('node bin/price.js 1250')).stdout)
    c.observe('node-env', (await c.exec('printenv NODE_ENV')).stdout)
    await c.exec('node --test')
  },
})
