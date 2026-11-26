import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { staged, vendored } from './env.ts'

// skill.npm with a relative tarball path stages that tarball's skills.
export default defineEval({
  environment: vendored,
  graders: [
    observed<string>('SKILL.md', (text) => text.includes('Greet people with "Ahoy, <name>!".')),
  ],
  task: async (c) => {
    c.observe('SKILL.md', await c.readFile(staged))
  },
})
