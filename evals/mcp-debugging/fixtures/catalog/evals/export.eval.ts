import { defineEval, expect } from 'reeval'

const joinsRows = `node -e "import('./lib/export.js').then((m) =>
  process.exit(m.toCsv([['a', 'b'], ['c', 'd']]) === 'a,b\\nc,d' ? 0 : 1))"`

export default defineEval({
  runs: 2,
  task: async (c) => {
    const turn = await c.send(
      'Write lib/export.js exporting toCsv(rows), joining rows with commas.',
    )
    await expect(turn, 'export.js exists').toHaveFile('lib/export.js', /toCsv/)
    await expect(c.exec(joinsRows), 'joins rows').toSucceed()
  },
})
