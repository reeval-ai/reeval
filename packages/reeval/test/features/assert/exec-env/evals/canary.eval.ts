import { defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'
import { plain } from './env.ts'

export default defineEval({
  environment: plain,
  graders: [succeeded('greets')],
  task: async (c) => {
    // The mistake: the variable is set under another name, so the command reads none.
    await c.exec('test "$GREETING" = hello', { env: { GREETNG: 'hello' }, label: 'greets' })
  },
})
