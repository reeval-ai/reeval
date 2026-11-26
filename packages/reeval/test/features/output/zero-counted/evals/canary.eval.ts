import { defineEval, expect } from 'reeval'
import { plain, working } from './env.ts'

// Must fail: the gated variant isn't the control. Its attempt counts, so its checks read counts,
// never not run.
export default defineEval({
  compare: { control: plain, variants: [working] },
  task: async (c) => {
    await expect(c.exec('true'), 'runs true').toSucceed()
    expect(c.attempt.cell.role, 'is the control').toBe('control')
  },
})
