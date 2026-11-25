import { readFileSync } from 'node:fs'
import { defineEnvironment, defineEval, expect } from 'reeval'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withErrors = math.extendEnvironment('errors', ({ skill }) => ({
  skills: [skill.local('./skills/errors')],
}))
const divideTest = readFileSync(new URL('./hidden/divide.test.js', import.meta.url), 'utf8')

export default defineEval({
  compare: { control: math, variants: [withErrors] },
  questions: [
    {
      question: 'Which divide() says more clearly what went wrong when b is 0?',
      across: 'environment',
      diff: true,
    },
  ],
  task: async (c) => {
    await c.send('Add a divide(a, b) function to src/math.js. It must throw when b is 0.')

    await c.writeFile('test/divide.test.js', divideTest)
    await expect(c.exec('node --test'), 'throws for 0').toSucceed()
  },
})
