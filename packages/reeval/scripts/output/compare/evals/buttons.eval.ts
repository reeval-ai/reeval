import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

const head = process.env.REEVAL_COMPARE_SIDE === 'head'

// Cases whose double case is fixed on head: its build fails on base, so types never runs there.
export default defineEval({
  cases: [{ key: 'reset' }, { key: 'double' }, { key: 'clear' }],
  graders: [succeeded('build'), succeeded('types')],
  task: async (c, { key: name }) => {
    await c.send(`Add a ${name} button.`)
    await c.exec(head ? 'true' : `test ${name} != double`, { label: 'build' })
    await c.exec('true', { label: 'types' })
  },
})
