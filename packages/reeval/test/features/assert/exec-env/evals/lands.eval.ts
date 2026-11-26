import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'

// `env` sets a variable for this command only.
export default defineEval({
  environment: plain,
  graders: [succeeded('greets')],
  task: async (c) => {
    await c.exec('test "$GREETING" = hello', { env: { GREETING: 'hello' }, label: 'greets' })
  },
})
