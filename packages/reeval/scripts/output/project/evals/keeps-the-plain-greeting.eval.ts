import { defineEnvironment, defineEval, regression } from 'reeval'
import { succeeded } from 'reeval/graders'

const plain = defineEnvironment('plain', {})
const withSkill = defineEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))
const withDoc = defineEnvironment('with-doc', {
  files: { 'docs/house-style.md': 'Our house greeting is "Ahoy, <name>!".\n' },
})

// Measure a change: the skill helps, the doc makes no difference, and with 4 trials a side the
// effort table prints because the eval failed. The second eval's skill makes it worse; the
// third has 1 trial a side, so its effect can't be told yet.

export default defineEval({
  target: regression(),
  trials: 4,
  compare: { baseline: plain, variants: [withSkill] },
  graders: [succeeded('says hello')],
  task: async (c) => {
    await c.send('Write greet.js that says Hello.')
    await c.exec('grep -q Hello greet.js', { label: 'says hello' })
  },
})
