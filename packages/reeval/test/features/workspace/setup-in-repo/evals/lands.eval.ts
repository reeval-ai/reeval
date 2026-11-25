import { defineEval, expect } from 'reeval'
import { built } from './env.ts'

// Setup steps run in the workspace after the repository is copied in.
export default defineEval({
  environment: built,
  task: async (c) => {
    expect(await c.readFile('seen-by-setup.txt')).toBe('v1\n')
  },
})
