import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    await c.send('write the app')
    // The mistake: the app is in src/, not lib/.
    await expect(c, 'writes the app').toHaveFile('lib/app.js', /answer = 42/)
  },
})
