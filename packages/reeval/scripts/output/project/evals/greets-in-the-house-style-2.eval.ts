import { defineEnvironment, defineEval, expect } from 'reeval'

const plain = defineEnvironment('plain', {})
const withSkill = defineEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))

// Cases on one cell: a row per case, the failing one with its checks. Cases with a change: the
// case outer, its arms inner, and the cases pooled into one effect.

export default defineEval({
  cases: ['Ada', 'Grace', 'Linus', 'Edsger'],
  compare: { control: plain, variants: [withSkill] },
  task: async (c, name) => {
    await c.send(`Write greet.js that greets ${name} in our house style.`)
    await expect(c.exec('grep -q Ahoy greet.js'), 'house greeting').toSucceed()
  },
})
