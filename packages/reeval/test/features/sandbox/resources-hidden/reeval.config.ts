import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox runs on the host, with no container to watch from outside.
export default defineConfig({
  agents: fakeAgent(),
})
