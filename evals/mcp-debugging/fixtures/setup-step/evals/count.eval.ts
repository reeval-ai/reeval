import { defineEnvironment, defineEval, regression } from 'reeval'
import { observed } from 'reeval/graders'

const fixtures = defineEnvironment('user-fixtures', ({ file }) => ({
  files: { 'scripts/prepare-fixture.js': file('../scripts/prepare-fixture.js') },
  setup: ['node scripts/prepare-fixtures.js'],
}))

export default defineEval({
  environment: fixtures,
  graders: [observed<string>('count', (count) => count === '3')],
  target: regression(),
  task: async (c) => {
    await c.send('Write count.js, which prints how many users data/users.json has.')
    const run = await c.exec('node count.js')
    c.observe('count', run.stdout.trim())
  },
})
