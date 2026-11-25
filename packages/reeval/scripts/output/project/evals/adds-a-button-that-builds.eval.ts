import { defineEnvironment, defineEval, expect } from 'reeval'

const plain = defineEnvironment('plain', {})
const withSkill = defineEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))

// Cases on one cell: a row per case, the failing one with its checks. Cases with a change: the
// case outer, its arms inner, and the cases pooled into one effect.
export default defineEval({
  cases: [{ name: 'reset' }, { name: 'double' }, { name: 'clear' }],
  task: async (c, { name }) => {
    await c.send(`Add a ${name} button.`)
    await expect(c, 'writes greet.js').toHaveFile('greet.js')
    await expect.require(c.exec(`test ${name} != double`), 'build').toSucceed()
    await expect(c.exec('true'), 'types').toSucceed()
  },
})
