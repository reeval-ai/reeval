import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })],
  budget: { attempts: 20 },
  profiles: {
    // A limit below the best-of makes it a fixed count.
    pr: { limit: { runs: 1 } },
    nightly: { defaults: { runs: { bestOf: 7 } } },
  },
})
