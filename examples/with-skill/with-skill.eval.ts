import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded, usedSkill } from 'reeval/graders'

// The small package in ./project, with the jsdoc skill placed where the agent reads skills.
const math = defineEnvironment('math', ({ directory, skill }) => ({
  files: directory('./project'),
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  environment: math,
  graders: [
    usedSkill('jsdoc'),
    hasFile('src/math.js', /@returns[^/]*\*\/\s*export function multiply/),
    succeeded('node --test'),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
