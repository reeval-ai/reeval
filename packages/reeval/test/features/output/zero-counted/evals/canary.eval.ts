import { defineEval, expect } from 'reeval'
import { plain, working } from './env.ts'

// Must fail: the gated control isn't a variant. Its variant's attempt counts, so its checks read
// counts, never not run.
export default defineEval({
  compare: { control: plain, variants: [working], gate: 'all' },
  task: async (c) => {
    await expect(c.exec('true'), 'runs true').toSucceed()
    expect(c.attempt.cell.role, 'is a variant').toBe('variant')
  },
})
