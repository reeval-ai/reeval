import { defineEval } from 'reeval'
import { inDiff } from 'reeval/graders'
import { plain } from './env.ts'
import { touchesTests } from './graders.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent changed no test, so the judge says no.
  graders: [touchesTests, inDiff('src/**')],
  task: async (c) => void (await c.send('add retry')),
})
