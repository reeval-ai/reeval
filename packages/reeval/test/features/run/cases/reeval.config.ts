import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { cases } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({}),
  environments: cases,
})
