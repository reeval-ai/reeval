import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { plain } from './env.ts'

// The judge's provider fails the first run's calls: an infra error, so --retry-errors runs the
// trial again, and this time the judge answers.
export default defineEval({
  environment: plain,
  graders: [
    judge('Does src/app.js export answer?', {
      name: 'written',
      inputs: { diff: true },
      model: 'typesafe-ai/jev-1.14.0',
    }),
  ],
  task: async (c) => void (await c.send('set the answer')),
})
