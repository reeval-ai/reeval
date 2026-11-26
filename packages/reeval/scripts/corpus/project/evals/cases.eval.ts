import { defineEnvironment, defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

const plain = defineEnvironment('plain', {})
const withHouseGreeting = defineEnvironment('with-house-greeting', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))

// Pooled cases: only the variant greets with Ahoy, so every case is a discordant pair and the
// record has a family with rates and a paired lift.
export default defineEval({
  cases: [{ key: 'Ada' }, { key: 'Grace' }],
  compare: { control: plain, variants: [withHouseGreeting], minLift: 0.2 },
  graders: [succeeded('grep -q Ahoy greet.js')],
  task: async (c, { key: name }) => {
    await c.send(`Write greet.js that greets ${name} in our house style.`)
    await c.exec('grep -q Ahoy greet.js')
  },
})
