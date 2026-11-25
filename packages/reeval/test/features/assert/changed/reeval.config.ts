import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// A shell write, which no file-edit event reports: only the workspace diff sees it.
export default defineConfig({
  agents: fakeAgent({ script: [[{ exec: 'echo "// updated" >> test/greet.test.js' }]] }),
})
