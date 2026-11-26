import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { greeting, staged } from './env.ts'

// skill.git without a path stages the skills under the repository's skills/ directory.
export default defineEval({
  environment: greeting,
  graders: [
    observed<string>('SKILL.md', (text) => text.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
