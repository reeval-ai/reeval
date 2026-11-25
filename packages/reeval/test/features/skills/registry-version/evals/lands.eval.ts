import { defineEval, expect } from 'reeval'
import { pinned, staged } from './env.ts'

// skill.registry('owner/repo@skill', { version }) stages that one skill from the repository's
// skills/ directory as it was at the version, not the branch head.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Greet people with "Ahoy, <name>!".')
  },
})
