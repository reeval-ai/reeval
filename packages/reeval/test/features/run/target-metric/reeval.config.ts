import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { observed } from './evals/env.ts'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  environments: observed,
})
