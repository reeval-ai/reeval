import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker tier only: cloud({ attemptsPerMachine: 2 }) on the fake VM service through REEVAL_VM_URL,
// both attempts at once on one machine. As the agent: who and where the shell runs, and its proxy.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: 'id -un; pwd; echo ~; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
})
