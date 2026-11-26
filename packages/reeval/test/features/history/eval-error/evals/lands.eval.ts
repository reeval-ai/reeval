import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { built } from './build.ts'
import { plain } from './env.ts'

// The task throws an EvalError only when the build fails; here it doesn't, so nothing is recorded.
export default defineEval({
  environment: plain,
  graders: [hasFile('src/app.js', 'module.exports')],
  task: async (c) => {
    await built(c, 'src/app.js')
  },
})
