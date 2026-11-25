import { defineEval, expect } from 'reeval'

export default defineEval({
  async task(c) {
    await c.send('ok')
    expect((await c.exec('printf define-eval')).stdout.trim(), 'api').toBe('not-define-eval')
  },
})
