import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  // The mistake: the app is in src/, not lib/.
  graders: [hasFile('lib/app.js', /answer = 42/)],
  task: async (c) => {
    await c.send('write the app')
  },
})
