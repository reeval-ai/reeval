import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, signature } from './env.ts'

// After a real turn, a session token the exchange hands the container is a placeholder: the
// gateway keeps the real one on the host.
export default defineEval({
  environment: plain,
  graders: [observed<string>('signature', (token) => token.startsWith('reeval_secret_'))],
  task: async (c) => {
    await c.send('Reply with the single word OK.')
    c.observe('signature', await signature(c.exec))
  },
})
