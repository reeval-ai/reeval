import { defineEnvironment, defineEval, expect } from 'reeval'
import { podman } from 'reeval/sandbox'

// The same sandbox as docker(), on Podman 4 or later. Podman keeps its own images.
const math = defineEnvironment('math', ({ directory }) => ({
  files: directory('./project'),
  sandbox: podman(),
}))

export default defineEval({
  environment: math,
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')

    await expect(c).toHaveFile('src/math.js', /export function multiply/)
    await expect(c.exec('node --test')).toSucceed()
  },
})
