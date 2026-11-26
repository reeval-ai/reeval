import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the environments set docker() themselves.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
})
