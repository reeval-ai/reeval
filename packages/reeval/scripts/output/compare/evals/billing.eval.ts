import { defineEnvironment, defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

const head = process.env.REEVAL_COMPARE_SIDE === 'head'

// Can't compare: the environment's doc changed between the runs, so its fingerprint did too.
const withDoc = defineEnvironment('with-doc', {
  files: { 'docs/billing.md': head ? 'Amounts are in pounds.\n' : 'Amounts are in pence.\n' },
})

export default defineEval({
  environment: withDoc,
  graders: [succeeded('amount in minor units')],
  task: async (c) => {
    await c.send('Bill the customer 12.50 GBP.')
    await c.exec('grep -q pence docs/billing.md', { label: 'amount in minor units' })
  },
})
