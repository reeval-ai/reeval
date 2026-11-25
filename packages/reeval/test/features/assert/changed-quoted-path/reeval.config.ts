import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// A non-ASCII path, which git C-quotes in a diff unless asked not to.
export default defineConfig({
  agents: fakeAgent({ script: [[{ write: { 'notes/café.txt': 'bonjour\n' } }]] }),
})
