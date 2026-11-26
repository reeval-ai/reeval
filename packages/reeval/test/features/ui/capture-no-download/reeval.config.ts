import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  capture: { timeout: '60s' },
})
