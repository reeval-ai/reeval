import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, staged } from './env.ts'

// Must fail: main's newer greeting isn't what the v1 tag holds.
export default defineEval({
  environment: pinned,
  graders: [observed<string>('SKILL.md', (text) => text.includes('Hello there, <name>.'))],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
