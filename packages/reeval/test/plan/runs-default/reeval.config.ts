import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent({ id: 'a' }),
  profiles: {
    pr: { limit: { runs: 1 } },
    off: { limit: { compare: false } },
    two: { defaults: { runs: 2 } },
  },
})
