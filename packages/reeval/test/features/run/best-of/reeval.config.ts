import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { bestOf } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({}),
  environments: bestOf,
})
