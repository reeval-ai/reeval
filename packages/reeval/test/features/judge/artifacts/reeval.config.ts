import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  agents: fakeAgent({}),
  judge: { model: fakeJudge({ score: 1 }) },
})
