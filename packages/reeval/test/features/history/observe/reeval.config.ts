import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const manifest = { dependencies: { 'drizzle-orm': '^0.40.0', pg: '^8.13.0' } }

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ files: { 'package.json': `${JSON.stringify(manifest)}\n` } }),
})
