import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'

const withJsdoc = defineEnvironment('jsdoc', ({ directory, skill }) => ({
  files: directory('./project'),
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  environment: withJsdoc,
  graders: [hasFile('src/math.js', /\*\/\s*export function multiply/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
  },
})
