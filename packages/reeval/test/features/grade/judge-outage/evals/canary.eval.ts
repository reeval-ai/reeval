import { defineEval } from 'reeval'
import { judge } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [
    judge('Does src/app.js export answer?', {
      name: 'written',
      inputs: { diff: true },
      model: 'typesafe-ai/jev-1.14.0',
      // The mistake: the retried judge says yes, which this grader scores 0.
      score: { true: 0, false: 1 },
    }),
  ],
  task: async (c) => void (await c.send('set the answer')),
})
