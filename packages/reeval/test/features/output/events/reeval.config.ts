import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  sandbox: fakeSandbox(),
})
