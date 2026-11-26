import { defineEnvironment, defineEval, expect, regression } from 'reeval'

const plain = defineEnvironment('plain', {})
const withSkill = defineEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))
const withDoc = defineEnvironment('with-doc', {
  files: { 'docs/house-style.md': 'Our house greeting is "Ahoy, <name>!".\n' },
})

// Measure a change: the skill helps, the doc makes no difference, and with 4 tries an arm the
// effort table prints because the eval failed. The second eval's skill makes it worse; the
// third has 1 try an arm, so its effect can't be told yet.

export default defineEval({
  target: regression(),
  runs: 4,
  compare: { control: plain, variants: [withSkill] },
  task: async (c) => {
    await c.send('Write greet.js that says Hello.')
    await expect(c.exec('grep -q Hello greet.js'), 'says hello').toSucceed()
  },
})
