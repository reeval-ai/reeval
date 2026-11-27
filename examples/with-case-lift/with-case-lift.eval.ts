import { defineEnvironment, defineEval, defineGrader, regression } from 'reeval'
import { hasFile } from 'reeval/graders/match'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

// The compare's lift is paired by case across all six cases, so one run a side gives a verdict.
// minLift gates that pooled lift, not each case's.
const functions = ['subtract', 'multiply', 'divide', 'power', 'max', 'min'].map((key) => ({ key }))

// Each case's function, with a JSDoc block right above it.
const documented = defineGrader('jsdoc-block', {
  files: ['src/math.js'],
  grade: (c) => hasFile(c, 'src/math.js', new RegExp(`\\*/\\s*export function ${c.case.key}\\b`)),
})

export default defineEval({
  cases: functions,
  compare: { baseline: math, variants: [withJsdoc], minLift: 0.2 },
  target: regression(),
  graders: [documented],
  task: async (c, { key: name }) => {
    await c.send(`Add a ${name}(a, b) function to src/math.js.`)
  },
})
