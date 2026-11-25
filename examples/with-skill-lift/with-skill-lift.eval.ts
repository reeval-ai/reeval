import { defineEnvironment, defineEval, expect } from 'reeval'

// The control is the small package in ./project; the variant adds the changelog skill.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withSkill = math.extendEnvironment('changelog', ({ skill }) => ({
  skills: [skill.local('./skills/changelog')],
}))

export default defineEval({
  compare: { control: math, variants: [withSkill] },
  runs: 4,
  gate: { passRate: 0.75 },
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')

    await expect(c.exec('node --test'), 'tests pass').toSucceed()
    await expect(c, 'changelog entry').toHaveFile('CHANGELOG.md', /## Unreleased\s+- feat: /)
  },
})
