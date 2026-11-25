import { defineEval, expect } from 'reeval'
import { pinned, staged } from './env.ts'

// skill.npm at a pinned version stages the skills/ directory of that version's tarball, not
// the latest one.
export default defineEval({
  environment: pinned,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Greet people with "Ahoy, <name>!".')
  },
})
