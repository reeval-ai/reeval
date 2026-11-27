import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'

// Two rules files for the same project. Each lands where the agent reads its rules (AGENTS.md,
// or CLAUDE.md for Claude Code).
const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const shortRules = math.extendEnvironment('short-rules', ({ file }) => ({
  rules: file('./rules/short.md'),
}))
const detailedRules = math.extendEnvironment('detailed-rules', ({ file }) => ({
  rules: file('./rules/detailed.md'),
}))

export default defineEval({
  compare: { baseline: shortRules, variants: [detailedRules] },
  graders: [succeeded('node --test'), hasFile('CHANGELOG.md', /## Unreleased\s+- feat: /)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
