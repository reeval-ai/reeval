import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { cases } from './evals/env.ts'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  environments: cases,
})
