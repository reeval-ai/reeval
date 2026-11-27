import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { docker } from 'reeval/sandbox'

// The same convention two ways: as a skill, and as a docs file in the workspace.
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withSkill = math.extendEnvironment('errors-skill', ({ skill }) => ({
  skills: [skill.local('./skills/errors')],
}))
const withDoc = math.extendEnvironment('errors-doc', ({ file }) => ({
  files: { 'docs/errors.md': file('./docs/errors.md') },
}))

// The hidden test runs against the agent's src/ in a sandbox of its own, offline, so the agent
// never sees it.
const throwsRangeError = defineGrader('throws-range-error', ({ file }) => ({
  env: docker(),
  files: ['src/**', 'package.json'],
  data: { test: file('./hidden/divide.test.js') },
  grade: async (c) => {
    await c.sandbox.writeFile('test/divide.test.js', c.data.test as string)
    return (await c.sandbox.exec('node --test test/divide.test.js')).exitCode === 0
  },
}))

export default defineEval({
  compare: { baseline: math, variants: [withSkill, withDoc] },
  graders: [throwsRangeError],
  task: async (c) => {
    await c.send('Add a divide(a, b) function to src/math.js.')
  },
})
