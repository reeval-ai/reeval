import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat, createBoat } from 'reeval/provider/boat'
import { createDaytona, daytona } from 'reeval/provider/daytona'

export default defineConfig({
  include: ['evals/**/*.eval.ts', '!evals/deny.eval.ts'],
  agents: fakeAgent(),
  profiles: {
    boat: { provider: boat() },
    'boat-large': { provider: boat({ type: 'large', maxConcurrent: 4 }) },
    'boat-pooled': {
      provider: createBoat({ prefix: 'team' })({ reuse: true, trialsPerMachine: 3 }),
    },
    daytona: { provider: daytona() },
    'daytona-shared': {
      provider: createDaytona({ prefix: 'team' })({
        size: 'small',
        reuse: true,
        trialsPerMachine: 2,
      }),
    },
  },
})
