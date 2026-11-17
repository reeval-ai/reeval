import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat, createBoat } from 'reeval/provider/boat'
import { createDaytona, daytona } from 'reeval/provider/daytona'

export default defineConfig({
  harnesses: fakeHarness(),
  profiles: {
    boat: { provider: boat() },
    'boat-large': { provider: boat({ type: 'large', maxConcurrent: 4 }) },
    'boat-pooled': {
      provider: createBoat({ prefix: 'team' })({ reuse: true, attemptsPerMachine: 3 }),
    },
    daytona: { provider: daytona() },
    'daytona-shared': {
      provider: createDaytona({ prefix: 'team' })({
        size: 'small',
        reuse: true,
        attemptsPerMachine: 2,
      }),
    },
  },
})
