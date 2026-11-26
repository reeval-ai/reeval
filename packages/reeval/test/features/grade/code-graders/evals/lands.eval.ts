import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { answers, masked, observed, ran, turns } from './graders.ts'

// Graders read the attempt once the task returns: its kept files, observations, execs and turns.
export default defineEval({
  environment: plain,
  graders: [answers(42), masked, observed, ran, turns],
  task: async (c) => {
    await c.send('write the app')
    const app = await c.exec('cat src/app.js', { label: 'app' })
    c.observe('lines', app.stdout.trim().split('\n').length)
  },
})
