import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, staged } from './env.ts'

// Must fail: the source frontmatter's other keys aren't copied.
export default defineEval({
  environment: greeting,
  graders: [observed<string>('SKILL.md', (text) => text.includes('license: MIT'))],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
