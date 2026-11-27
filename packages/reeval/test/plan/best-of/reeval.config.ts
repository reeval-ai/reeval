import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })],
  budget: { trials: 20 },
  profiles: {
    // A limit below the best-of makes it a fixed count.
    pr: { limit: { trials: 1 } },
    nightly: { defaults: { trials: { bestOf: 7 } } },
  },
})
