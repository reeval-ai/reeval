import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  capture: { model: 'anthropic/scripted-stuck' },
})
