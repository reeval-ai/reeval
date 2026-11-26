import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ files: { 'build.log': `${'compiled\n'.repeat(4000)}` } }),
})
