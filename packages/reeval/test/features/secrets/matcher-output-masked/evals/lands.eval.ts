import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { command } from './token.ts'

// A command that succeeds is quoted nowhere, whatever it printed.
export default defineEval({
  environment: plain,
  task: async (c) => {
    await expect(c.exec(...command(0))).toSucceed()
  },
})
