import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox can't enforce a policy, so reeval run would exit 2. REEVAL_EGRESS_TARGET
// is a listener on the host that features.test.ts starts, at a non-loopback address.
export default defineConfig({
  // As the agent: fetch the listener through the gateway.
  agents: fakeAgent({
    script: [[{ exec: `curl -sS -m 10 http://${process.env.REEVAL_EGRESS_TARGET}/` }]],
  }),
})
