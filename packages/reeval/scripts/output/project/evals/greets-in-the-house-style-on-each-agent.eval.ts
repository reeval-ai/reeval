import { defineEnvironment, defineEval, expect } from 'reeval'
import { fakeAgent } from 'reeval/agent'

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
  agents: [skilled, terse],
  task: async (c) => {
    await c.send('Write greet.js that greets in our house style.')
    await expect(c, 'writes greet.js').toHaveFile('greet.js')
    await expect.require(c.exec('grep -q Ahoy greet.js'), 'house greeting').toSucceed()
    await expect(c.exec('grep -q "!" greet.js'), 'exclaims').toSucceed()
  },
})
