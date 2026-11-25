import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { observed } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({}),
  environments: observed,
})
