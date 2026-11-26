import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'

export default defineEval({
  graders: [observed('api', (api) => api === 'not-define-eval')],
  task: async (c) => {
    await c.send('ok')
    c.observe('api', (await c.exec('printf define-eval')).stdout.trim())
  },
})
