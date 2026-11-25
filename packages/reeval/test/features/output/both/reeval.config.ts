import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({}),
  // One attempt a cell, where a compare would otherwise run 4 a side.
  runs: 1,
  sandbox: fakeSandbox(),
})
