import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox has no limits to set.
export default defineConfig({
  agents: fakeAgent(),
})
