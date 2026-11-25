import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox runs on the host, with no container of its own to read.
export default defineConfig({
  agents: fakeAgent(),
})
