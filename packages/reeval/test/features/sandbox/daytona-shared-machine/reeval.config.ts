import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: daytona({ attemptsPerMachine: 2 }) on the fake Daytona API, both attempts at
// once on one machine. As the agent: who and where the shell runs, and its proxy.
export default defineConfig({
  agents: fakeAgent({
    script: [[{ exec: 'id -un; pwd; echo ~; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
  provider: daytona({ attemptsPerMachine: 2, maxConcurrent: 2 }),
})
