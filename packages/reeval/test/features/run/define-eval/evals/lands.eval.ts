import { defineEval, expect } from 'reeval'

// one export default defineEval per file
export default defineEval({
  async task(c) {
    await c.send('ok')
    expect((await c.exec('printf define-eval')).stdout.trim(), 'api').toBe('define-eval')
  },
})
