import { defineEval, expect } from 'reeval'
import { unbuilt } from './env.ts'

// Must fail: this build writes nothing, so the unpacked subagent is the source's placeholder.
export default defineEval({
  environment: unbuilt,
  task: async (c) => {
    expect(await c.readFile('.opencode/agents/reviewer.md')).toContain('BUILT-58')
  },
})
