import { defineEnvironment, defineEval } from 'reeval'
import { observed, succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// The Dockerfile path is relative to this file. Its image has sqlite3 and a seeded /opt/shop.db.
const shop = defineEnvironment('shop', {
  sandbox: docker({ dockerfile: './sqlite/Dockerfile' }),
})

export default defineEval({
  environment: shop,
  graders: [succeeded('report'), observed('report', (rows) => rows === 'Ada\nGrace\nLinus\n')],
  task: async (c) => {
    await c.send(
      'Write report.sql, a query on /opt/shop.db that lists the customer names alphabetically.',
    )

    const report = await c.exec('sqlite3 /opt/shop.db < report.sql', { label: 'report' })
    c.observe('report', report.stdout)
  },
})
