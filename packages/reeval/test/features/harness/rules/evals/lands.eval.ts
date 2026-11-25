import { defineEval, expect } from 'reeval'
import { rulesFile } from '../layout.ts'
import { houseRules } from './env.ts'

// `rules` become the workspace file the harness reads, word for word.
export default defineEval({
  environment: houseRules,
  task: async (c) => {
    expect(await c.readFile(rulesFile)).toBe('Always write tests.')
  },
})
