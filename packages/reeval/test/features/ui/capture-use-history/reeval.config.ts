import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent({}),
  capture: { model: 'anthropic/scripted-vision' },
})
