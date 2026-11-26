import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { houseRules } from './env.ts'

// Must fail: rules go to AGENTS.md, not Claude's CLAUDE.md.
export default defineEval({
  environment: houseRules,
  graders: [hasFile('CLAUDE.md', 'Always write tests.')],
  task: async (c) => {
    await c.exec('true')
  },
})
