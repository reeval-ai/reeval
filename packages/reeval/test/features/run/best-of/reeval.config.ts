import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { bestOf } from './evals/env.ts'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  environments: bestOf,
})
