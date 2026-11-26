import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, ran, succeeded } from 'reeval/graders'

// The small package in ./project, with ./rules.md written where the agent reads project rules
// (CLAUDE.md for Claude Code, AGENTS.md for the others).
const math = defineEnvironment('math', ({ directory, file }) => ({
  files: directory('./project'),
  rules: file('./rules.md'),
}))

export default defineEval({
  environment: math,
  graders: [
    ran(/npm test/, { name: 'runs-the-tests' }),
    hasFile('test/math.test.js', 'multiply', { name: 'adds-a-test' }),
    succeeded('npm test'),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('npm test')
  },
})
