import { defineEval, expect } from 'reeval'
import { patched } from './env.ts'

// files are written after the repository is copied in, so they win.
export default defineEval({
  environment: patched,
  task: async (c) => {
    expect(await c.readFile('greet.js')).toContain('Howdy')
  },
})
