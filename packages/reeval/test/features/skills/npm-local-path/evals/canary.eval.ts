import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { staged, vendored } from './env.ts'

// Must fail: the other vendored tarball's greeting isn't what 1.2.3 holds.
export default defineEval({
  environment: vendored,
  graders: [observed<string>('SKILL.md', (text) => text.includes('Hello there, <name>.'))],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
