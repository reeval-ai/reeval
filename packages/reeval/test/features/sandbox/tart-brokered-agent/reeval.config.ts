import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { credential, layout } from './layout.ts'

// tart() on the fake `tart`. As the agent, through the VM's harness session: the key of the
// harness REEVAL_FIXTURE_LAYOUT names, which the gateway brokers, and the proxy it goes out through.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    layout,
    brokers: true,
    script: [[{ exec: `printf "%s\\n" "$${credential}"; printenv HTTPS_PROXY || echo no-proxy` }]],
  }),
})
