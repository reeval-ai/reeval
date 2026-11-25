import { defineEval, expect } from 'reeval'
import { plain } from './env.ts'
import { command } from './token.ts'

export default defineEval({
  environment: plain,
  task: async (c) => {
    // Must fail, quoting each stream's last 2000 characters, where both secrets start.
    await expect(c.exec(...command(1))).toSucceed()
  },
})
