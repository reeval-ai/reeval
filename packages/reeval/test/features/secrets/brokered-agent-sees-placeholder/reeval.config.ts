import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, docker (D) or podman.
export default defineConfig({
  target: regression(),
  // As the agent: print the brokered secret, then the proxy the gateway sets (or "no-proxy").
  agents: fakeAgent({
    script: [[{ exec: 'printenv API_KEY; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
})
