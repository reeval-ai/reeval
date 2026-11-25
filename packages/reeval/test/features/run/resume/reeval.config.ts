import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { resume } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({}),
  environments: resume,
})
