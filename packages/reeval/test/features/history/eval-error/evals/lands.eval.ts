import { defineEval, expect } from 'reeval'
import { built } from './build.ts'
import { plain } from './env.ts'

// The task throws an EvalError only when the build fails; here it doesn't, so nothing is recorded.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await built(c, 'src/app.js')
    expect(await c.readFile('src/app.js'), 'writes the app').toContain('module.exports')
  },
})
