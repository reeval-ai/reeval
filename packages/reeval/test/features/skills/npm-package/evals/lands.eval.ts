import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, staged } from './env.ts'

// skill.npm at a pinned version stages the skills/ directory of that version's tarball, not
// the latest one.
export default defineEval({
  environment: pinned,
  graders: [
    observed<string>('SKILL.md', (text) => text.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
