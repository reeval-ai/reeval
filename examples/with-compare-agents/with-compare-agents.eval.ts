import { defineEnvironment, defineEval, expect } from 'reeval'
import { claudeCode, codex } from 'reeval/agent'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withJsdoc = math.extendEnvironment('jsdoc', ({ skill }) => ({
  skills: [skill.local('./skills/jsdoc')],
}))

export default defineEval({
  pin: ['agents'],
  agents: [claudeCode({ model: 'claude-sonnet-5' }), codex({ model: 'gpt-5.6-luna' })],
  compare: {
    control: math,
    variants: [withJsdoc],
    // Only Claude Code runs the variant; Codex runs the control alone.
    agents: ['claude-code:claude-sonnet-5'],
  },
  questions: [{ question: 'Which multiply() is easier to read?', across: 'agent', diff: true }],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js.')

    await expect(c.exec('node --test'), 'tests pass').toSucceed()
    await expect(c, 'JSDoc block').toHaveFile('src/math.js', /\*\/\s*export function multiply/)
  },
})
