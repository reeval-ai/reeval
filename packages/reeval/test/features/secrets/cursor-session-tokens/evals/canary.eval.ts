import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain, signature } from './env.ts'

// Must fail: before a turn no runner holds the key, so there's nothing to exchange.
export default defineEval({
  environment: plain,
  graders: [observed<string>('signature', (token) => token.startsWith('reeval_secret_'))],
  task: async (c) => {
    c.observe('signature', await signature(c.exec))
  },
})
