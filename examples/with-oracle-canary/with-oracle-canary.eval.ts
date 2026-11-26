import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// The agent starts from the small package in ./project.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))

// Runs in a sandbox of its own once the task returns, so the agent never sees it: its own tests
// can't stand in for it.
const clampClamps = defineGrader('clamp-clamps', ({ file }) => ({
  env: docker(),
  files: ['src/**', 'package.json'],
  data: { check: file('./hidden/clamp.mjs') },
  grade: async (c) => {
    await c.sandbox.writeFile('clamp.check.mjs', c.data.check as string)
    return (await c.sandbox.exec('node clamp.check.mjs')).exitCode === 0
  },
}))

export default defineEval({
  environment: math,
  graders: [succeeded('node --test', { name: 'its-tests-pass' }), clampClamps],
  task: async (c) => {
    await c.send('Add a clamp(n, min, max) function to src/math.js, with a test.')
    await c.exec('node --test')
  },
})
