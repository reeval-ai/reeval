import { defineEval, expect } from 'reeval'
import { homeFiles } from './env.ts'

// Must fail: a `~/` file isn't written into the workspace.
export default defineEval({
  environment: homeFiles,
  task: async (c) => {
    expect(await c.readFile('.config/reeval/hint.txt')).toBe('from home')
  },
})
