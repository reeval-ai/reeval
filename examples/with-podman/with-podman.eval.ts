import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'
import { podman } from 'reeval/sandbox'

// The same sandbox as docker(), on Podman 4 or later. Podman keeps its own images.
const math = defineEnvironment('math', ({ directory }) => ({
  files: directory('./project'),
  sandbox: podman(),
}))

export default defineEval({
  environment: math,
  graders: [hasFile('src/math.js', /export function multiply/), succeeded('node --test')],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')
    await c.exec('node --test')
  },
})
