import { defineEnvironment, defineEval } from 'reeval'
import { claudeCode, codex } from 'reeval/agent'
import { hasFile, succeeded } from 'reeval/graders'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  pin: ['agents'],
  agents: [claudeCode({ model: 'claude-sonnet-5' }), codex({ model: 'gpt-5.6-luna' })],
  compare: {
    baseline: math,
    variants: [withJsdoc],
    // Only Claude Code runs the variant; Codex runs the baseline alone.
    agents: ['claude-code:claude-sonnet-5'],
  },
  questions: [{ question: 'Which multiply() is easier to read?', across: 'agent', diff: true }],
  graders: [succeeded('node --test'), hasFile('src/math.js', /\*\/\s*export function multiply/)],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')
    await c.exec('node --test')
  },
})
