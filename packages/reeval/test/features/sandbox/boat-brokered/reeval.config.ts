import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API. As the agent: print the brokered secret.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: 'printenv API_KEY' }]] }),
  provider: boat(),
})
