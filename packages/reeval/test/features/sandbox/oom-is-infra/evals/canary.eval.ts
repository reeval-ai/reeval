import { defineEval, expect } from 'reeval'
import { small } from './env.ts'

// Must fail as an assertion: the command exits 137 from its own SIGKILL, with no OOM kill.
export default defineEval({
  environment: small,
  task: async (c) => {
    await expect(c.exec('kill -9 $$')).toSucceed()
  },
})
