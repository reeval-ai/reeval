import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'
import { daytona } from 'reeval/provider/daytona'
import { docker } from 'reeval/sandbox'

export default defineConfig({
  include: ['evals/**/*.eval.ts', '!evals/deny.eval.ts'],
  agents: fakeAgent(),
  sandbox: docker({ from: 'node:24-bookworm', maxConcurrent: 2 }),
  provider: boat(),
  profiles: {
    daytona: { provider: daytona({ size: 'large' }), defaults: { egress: 'allow-all' } },
  },
})
