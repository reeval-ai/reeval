import { defineEnvironment, defineEval, metric } from 'reeval'
import { hasFile } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  compare: { control: math, variants: [withJsdoc], minLift: 0.2 },
  runs: 4,
  target: metric(0.75),
  graders: [hasFile('src/math.js', /\*\/\s*export function multiply/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
  },
})
