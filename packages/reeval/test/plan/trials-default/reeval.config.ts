import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent({ id: 'a' }),
  profiles: {
    pr: { limit: { trials: 1 } },
    off: { limit: { compare: false } },
    two: { defaults: { trials: 2 } },
  },
})
