import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: daytona({ trialsPerMachine: 2 }) on the fake Daytona API, both trials at
// once on one machine. As the agent: who and where the shell runs, and its proxy.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: 'id -un; pwd; echo ~; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
  provider: daytona({ trialsPerMachine: 2, maxConcurrent: 2 }),
})
