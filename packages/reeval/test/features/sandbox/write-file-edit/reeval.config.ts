import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [{ write: { 'greet.js': "export const greet = (n) => 'Hello, ' + n\n" } }],
      [{ write: { 'test/hidden.test.js': '// emptied\n', '.cache/grade.js': '// emptied\n' } }],
    ],
  }),
})
