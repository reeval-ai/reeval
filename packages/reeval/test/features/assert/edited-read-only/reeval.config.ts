import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// A shell command that names notes.txt but only reads it.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: 'cat notes.txt' }]] }),
})
