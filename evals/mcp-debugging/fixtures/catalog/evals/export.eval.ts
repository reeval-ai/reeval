import { defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const joinsRows = `node -e "import('./lib/export.js').then((m) =>
  process.exit(m.toCsv([['a', 'b'], ['c', 'd']]) === 'a,b\\nc,d' ? 0 : 1))"`

export default defineEval({
  runs: 2,
  graders: [hasFile('lib/export.js', /toCsv/, { required: true }), succeeded('joins rows')],
  task: async (c) => {
    await c.send('Write lib/export.js exporting toCsv(rows), joining rows with commas.')
    await c.exec(joinsRows, { label: 'joins rows' })
  },
})
