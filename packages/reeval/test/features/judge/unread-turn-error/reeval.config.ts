import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// Every turn fails as an outage would, which c.send returns rather than throws.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ error: '503 Service Unavailable: overloaded' }]] }),
})
