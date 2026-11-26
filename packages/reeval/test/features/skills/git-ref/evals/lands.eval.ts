import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, staged } from './env.ts'

// skill.git at a tag stages the skill as it was at that tag, not the branch head.
export default defineEval({
  environment: pinned,
  graders: [
    observed<string>('SKILL.md', (text) => text.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
