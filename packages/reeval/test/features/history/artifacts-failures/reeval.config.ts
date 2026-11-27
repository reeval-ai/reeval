import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  // One trial a cell, where a compare would otherwise run 4 a side.
  trials: 1,
  record: 'always',
  history: { artifacts: 'failures' },
})
