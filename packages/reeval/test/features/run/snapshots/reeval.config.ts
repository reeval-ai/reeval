import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { snapshots } from './evals/env.ts'

export default defineConfig({
  target: regression(),
  agents: fakeAgent({ files: { 'app/built.js': 'export const built = true\n' } }),
  environments: snapshots,
})
