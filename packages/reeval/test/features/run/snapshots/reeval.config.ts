import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { snapshots } from './evals/env.ts'

export default defineConfig({
  agents: fakeAgent({ files: { 'app/built.js': 'export const built = true\n' } }),
  environments: snapshots,
})
