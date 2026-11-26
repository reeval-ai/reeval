import { defineEnvironment, defineEval, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { hasFile, succeeded } from 'reeval/graders'

const greet = "export const greet = (name) => 'Hello, ' + name + '!'\n"
const ahoy = "export const greet = (name) => 'Ahoy, ' + name + '!'\n"

const skilled = fakeAgent({ id: 'skilled', files: { 'greet.js': ahoy } })
const terse = fakeAgent({ id: 'terse', files: { 'greet.js': greet } })
const learner = fakeAgent({
  id: 'learner',
  files: { 'greet.js': greet },
  withSkill: { files: { 'greet.js': ahoy } },
})

const plain = defineEnvironment('plain', {})
const withSkill = defineEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/house-greeting')],
}))

// Compare agents: the terse agent never greets in the house style. With a change too, the
// harness is outer and the arms inner: the learner needs the skill, the terse one ignores it.
export default defineEval({
  target: regression(),
  agents: [skilled, terse],
  graders: [
    hasFile('greet.js', { name: 'writes greet.js' }),
    succeeded('house greeting', { required: true }),
    succeeded('exclaims'),
  ],
  task: async (c) => {
    await c.send('Write greet.js that greets in our house style.')
    await c.exec('grep -q Ahoy greet.js', { label: 'house greeting' })
    await c.exec('grep -q "!" greet.js', { label: 'exclaims' })
  },
})
