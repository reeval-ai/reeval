import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { resume } from './evals/env.ts'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({}),
  environments: resume,
})
