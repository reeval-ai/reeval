import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// The baseline is the small package in ./project; the variant adds the changelog skill.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withSkill = math.extendEnvironment('changelog', ({ skill }) => ({
  skills: [skill.local('./skills/changelog')],
}))

export default defineEval({
  compare: { baseline: math, variants: [withSkill] },
  trials: 4,
  graders: [succeeded('node --test'), hasFile('CHANGELOG.md', /## Unreleased\s+- feat: /)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
