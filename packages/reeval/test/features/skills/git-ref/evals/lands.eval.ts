import { defineEval, expect } from 'reeval'
import { pinned, staged } from './env.ts'

// skill.git at a tag stages the skill as it was at that tag, not the branch head.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Greet people with "Ahoy, <name>!".')
  },
})
