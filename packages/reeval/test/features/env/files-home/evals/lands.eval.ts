import { defineEval, expect } from 'reeval'
import { homeFiles } from './env.ts'

// A `~/` file lands in the sandbox's home directory.
export default defineEval({
  environment: homeFiles,
  task: async (c) => {
    expect(await c.readFile('~/.config/reeval/hint.txt')).toBe('from home')
  },
})
