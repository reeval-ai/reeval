import { defineEval, expect } from 'reeval'
import { staged, vendored } from './env.ts'

// skill.npm with a relative tarball path stages that tarball's skills.
export default defineEval({
  environment: vendored,
  task: async (c) => {
    expect(await c.readFile(staged)).toContain('Greet people with "Ahoy, <name>!".')
  },
})
