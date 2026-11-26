import { defineEnvironment, defineEval } from 'reeval'
import { notInDiff, succeeded } from 'reeval/graders'

// The agent starts from ./project, whose median() sorts numbers as strings.
const stats = defineEnvironment('stats', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: stats,
  // An attempt scores 0 if the tests still fail, or if it edits them, however green they are.
  graders: [succeeded('npm test', { required: true }), notInDiff('test/**', { required: true })],
  task: async (c) => {
    await c.send('npm test fails. Find the bug in src/ and fix it.')
    await c.exec('npm test')
  },
})
