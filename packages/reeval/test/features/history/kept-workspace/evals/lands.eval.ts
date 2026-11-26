import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

// The workspace as the attempt left it is kept whole: what git doesn't ignore, masked.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('write the app')
    await expect(c, 'writes the app').toHaveFile('src/app.js', /answer = 42/)
  },
})
