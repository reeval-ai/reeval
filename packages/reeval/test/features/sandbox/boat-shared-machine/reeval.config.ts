import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

// Docker tier only: boat({ attemptsPerMachine: 2 }) on the fake Boat API, both attempts at once on
// one machine. As the agent: who and where the shell runs, and its proxy.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: 'id -un; pwd; echo ~; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
  provider: boat({ attemptsPerMachine: 2, maxConcurrent: 2 }),
})
