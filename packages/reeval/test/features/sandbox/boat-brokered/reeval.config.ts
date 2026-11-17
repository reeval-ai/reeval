import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API. As the agent: print the brokered secret.
export default defineConfig({
  harnesses: fakeHarness({ script: [[{ exec: 'printenv API_KEY' }]] }),
  provider: boat(),
})
