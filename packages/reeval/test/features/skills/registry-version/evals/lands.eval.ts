import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { pinned, staged } from './env.ts'

// skill.registry('owner/repo@skill', { version }) stages that one skill from the repository's
// skills/ directory as it was at the version, not the branch head.
export default defineEval({
  environment: pinned,
  graders: [
    observed<string>('SKILL.md', (text) => text.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
