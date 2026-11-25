import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox can't enforce a policy, so reeval run would exit 2.
export default defineConfig({
  // As the agent: fetch the listener, which is the brokered secret's host.
  agents: fakeAgent({
    script: [[{ exec: `curl -sS -m 10 http://${process.env.REEVAL_EGRESS_TARGET}/` }]],
  }),
})
