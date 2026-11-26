import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { small } from './env.ts'

// Must fail as a graded check: the command exits 137 from its own SIGKILL, with no OOM kill.
export default defineEval({
  environment: small,
  graders: [succeeded('kill')],
  task: async (c) => {
    await c.exec('kill -9 $$', { label: 'kill' })
  },
})
