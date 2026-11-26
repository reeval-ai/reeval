import { defineEnvironment, defineEval, metric } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withLayout = math.extendEnvironment('project-layout', ({ skill }) => ({
  skills: [skill.local('./skills/project-layout')],
}))

export default defineEval({
  compare: { control: math, variants: [withLayout] },
  runs: 4,
  target: metric(0.75),
  graders: [hasFile('test/math.test.js', 'multiply'), succeeded('node --test')],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test.')
    await c.exec('node --test')
  },
})
