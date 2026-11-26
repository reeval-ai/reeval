import { defineEval, expect } from 'reeval'

const head = process.env.REEVAL_COMPARE_SIDE === 'head'

// Cases whose double case is fixed on head: its build fails on base, so types never runs there.
export default defineEval({
  cases: [{ key: 'reset' }, { key: 'double' }, { key: 'clear' }],
  task: async (c, { key: name }) => {
    await c.send(`Add a ${name} button.`)
    await expect(c.exec(head ? 'true' : `test ${name} != double`), 'build').toSucceed()
    await expect(c.exec('true'), 'types').toSucceed()
  },
})
