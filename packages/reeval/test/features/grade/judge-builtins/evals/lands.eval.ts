import { defineEval } from 'reeval'
import { hasFile, inDiff } from 'reeval/graders'
import { plain } from './env.ts'
import { twoDependencyFiles } from './graders.ts'

// A judge grader beside built-ins, under the config's turns().
export default defineEval({
  environment: plain,
  graders: [twoDependencyFiles, inDiff('src/**'), hasFile('src/retry.ts')],
  task: async (c) => void (await c.send('add retry')),
})
