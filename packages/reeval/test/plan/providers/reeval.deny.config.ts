import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { boat } from 'reeval/provider/boat'

export default defineConfig({
  include: ['evals/deny.eval.ts'],
  agents: fakeAgent(),
  provider: boat(),
})
