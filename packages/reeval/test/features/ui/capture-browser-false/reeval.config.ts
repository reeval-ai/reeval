import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent({}),
  capture: { browser: false },
})
