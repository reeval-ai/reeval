import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { houseRules } from './env.ts'

// `rules` become the workspace's AGENTS.md, word for word.
export default defineEval({
  environment: houseRules,
  graders: [hasFile('AGENTS.md', 'Always write tests.')],
  task: async (c) => {
    await c.exec('true')
  },
})
