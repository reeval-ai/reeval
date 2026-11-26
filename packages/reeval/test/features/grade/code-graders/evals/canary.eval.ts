import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { answers, masked, observed, ran, turns } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: the app answers 42, not 41.
  graders: [answers(41), masked, observed, ran, turns],
  task: async (c) => {
    await c.send('write the app')
    const app = await c.exec('cat src/app.js', { label: 'app' })
    c.observe('lines', app.stdout.trim().split('\n').length)
  },
})
