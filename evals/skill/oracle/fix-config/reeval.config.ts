import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: { 'answer.md': 'Page with the `limit` query parameter, at most 100.\n' },
    text: 'I answered in answer.md.',
  }),
  sandbox: fakeSandbox(),
  judge: { model: fakeJudge({ score: 0.9 }) },
})
