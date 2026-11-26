import { defineEnvironment, defineEval } from 'reeval'
import { judge, succeeded } from 'reeval/graders'

// The agent starts from ./project: orders.csv, three orders totaling 50.
const orders = defineEnvironment('orders', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: orders,
  graders: [
    succeeded('node summary.js'),
    // checks shows the judge the stored c.exec results it names: here what summary.js printed.
    judge('Does it say there are 3 orders totaling 50?', {
      inputs: { checks: ['node summary.js'] },
    }),
  ],
  task: async (c) => {
    await c.send('Write summary.js. It prints how many orders orders.csv has, and their total.')
    await c.exec('node summary.js')
  },
})
