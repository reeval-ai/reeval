import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { plain } from './env.ts'

// The workspace as the trial left it is kept whole: what git doesn't ignore, masked.
export default defineEval({
  environment: plain,
  graders: [hasFile('src/app.js', /answer = 42/)],
  task: async (c) => {
    await c.send('write the app')
  },
})
