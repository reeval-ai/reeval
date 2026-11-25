import { defineEval, expect } from 'reeval'
import { pins } from './env.ts'

// Must fail: PLACEHOLDER prints too.
export default defineEval({
  environment: pins,
  task: async (c) => {
    await c.send('print PIN and PLACEHOLDER')
    expect((await c.exec('printf "%s\\n" "$PIN" "$PLACEHOLDER"')).stdout).toBe('1234\n')
  },
})
