import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, staged } from './env.ts'

// Must fail: the staged skill greets with "Ahoy", not "Hello there".
export default defineEval({
  environment: greeting,
  graders: [observed<string>('SKILL.md', (text) => text.includes('Hello there, <name>.'))],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
