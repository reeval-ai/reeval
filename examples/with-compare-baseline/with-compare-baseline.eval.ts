import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withTesting = math.extendEnvironment('testing', ({ skill }) => ({
  skills: [skill.local('./skills/testing')],
}))

export default defineEval({
  compare: { baseline: math, variants: [withTesting] },
  graders: [succeeded('node --test'), hasFile('test/math.test.js', /multiply\(/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
