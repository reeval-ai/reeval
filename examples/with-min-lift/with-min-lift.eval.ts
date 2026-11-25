import { defineEnvironment, defineEval, expect } from 'reeval'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  compare: { control: math, variants: [withJsdoc], minLift: 0.2 },
  runs: 4,
  gate: { passRate: 0.75 },
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await expect(c, 'JSDoc block').toHaveFile('src/math.js', /\*\/\s*export function multiply/)
  },
})
