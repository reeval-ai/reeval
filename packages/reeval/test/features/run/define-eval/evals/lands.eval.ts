import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

// one export default defineEval per file
export default defineEval({
  graders: [observed('api', (api) => api === 'define-eval')],
  task: async (c) => {
    await c.send('ok')
    c.observe('api', (await c.exec('printf define-eval')).stdout.trim())
  },
})
