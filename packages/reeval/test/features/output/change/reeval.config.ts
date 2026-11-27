import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  // One trial a cell, where a compare would otherwise run 4 a side.
  trials: 1,
  sandbox: fakeSandbox(),
})
