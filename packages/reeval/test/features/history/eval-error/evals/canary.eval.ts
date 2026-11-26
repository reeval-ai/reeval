import { defineEval } from 'reeval'
import { built } from './build.ts'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    // The mistake: the agent wrote src/app.js, not src/main.js.
    await built(c, 'src/main.js')
  },
})
