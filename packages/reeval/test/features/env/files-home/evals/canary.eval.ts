import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { homeFiles } from './env.ts'

// Must fail: a `~/` file isn't written into the workspace.
export default defineEval({
  environment: homeFiles,
  graders: [hasFile('.config/reeval/hint.txt', 'from home')],
  task: async (c) => {
    await c.exec('true')
  },
})
