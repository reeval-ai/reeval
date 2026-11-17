import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'
import { daytona } from 'reeval/provider/daytona'
import { docker } from 'reeval/sandbox'

export default defineConfig({
  harnesses: fakeHarness(),
  sandbox: docker({ from: 'node:24-bookworm', maxConcurrent: 2 }),
  provider: boat(),
  profiles: {
    daytona: { provider: daytona({ size: 'large' }), defaults: { egress: 'allow-all' } },
  },
})
