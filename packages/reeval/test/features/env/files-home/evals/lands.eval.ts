import { defineEval } from 'reeval'
import { hint, homeFiles, prints } from './env.ts'

// A `~/` file lands in the sandbox's home directory.
export default defineEval({
  environment: homeFiles,
  graders: [prints('home-hint', hint, 'from home')],
  task: async (c) => {
    await c.exec(hint)
  },
})
