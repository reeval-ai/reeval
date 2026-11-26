import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, staged } from './env.ts'

// Must fail: the latest version's greeting isn't what 1.2.3 holds.
export default defineEval({
  environment: pinned,
  graders: [observed<string>('SKILL.md', (text) => text.includes('Hello there, <name>.'))],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
