import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// The control is the small package in ./project; the variant adds the changelog skill.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withSkill = math.extendEnvironment('changelog', ({ skill }) => ({
  skills: [skill.local('./skills/changelog')],
}))

export default defineEval({
  compare: { control: math, variants: [withSkill] },
  runs: 4,
  graders: [succeeded('node --test'), hasFile('CHANGELOG.md', /## Unreleased\s+- feat: /)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
