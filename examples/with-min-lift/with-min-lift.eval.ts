import { defineEnvironment, defineEval, regression } from 'reeval'
import { hasFile } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  compare: { baseline: math, variants: [withJsdoc], minLift: 0.2 },
  trials: 4,
  target: regression(),
  graders: [hasFile('src/math.js', /\*\/\s*export function multiply/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
  },
})
