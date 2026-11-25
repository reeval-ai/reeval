import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  // As the agent: print the checks-only secret, or "unset".
  agents: fakeAgent({ script: [[{ exec: 'printenv CHECK_TOKEN || echo unset' }]] }),
})
