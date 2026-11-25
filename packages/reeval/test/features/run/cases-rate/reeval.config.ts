import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { rate } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({}),
  environments: rate,
})
