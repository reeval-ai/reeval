import { defineEnvironment, defineEval, expect } from 'reeval'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: math,
  agents: (inherited) => inherited.filter((h) => h.id !== 'fake-careful'),
  task: async (c) => {
    await c.send('Add a subtract(a, b) function to src/math.js.')

    await expect(c).toHaveFile('src/math.js', /export function subtract/)
  },
})
