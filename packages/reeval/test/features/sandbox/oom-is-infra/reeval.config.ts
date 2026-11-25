import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox has no memory limit to hit.
export default defineConfig({
  agents: fakeAgent(),
})
