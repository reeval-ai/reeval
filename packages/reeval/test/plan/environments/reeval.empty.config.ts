import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

/** No default environments, so nothing but the eval names one. */
export default defineConfig({
  agents: fakeAgent(),
})
