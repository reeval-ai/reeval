import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  agents: fakeAgent({}),
  // One attempt a cell, where a compare would otherwise run 4 a side.
  runs: 1,
})
