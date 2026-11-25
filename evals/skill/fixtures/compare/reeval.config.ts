import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis, fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: { 'index.html': '<h1>Acme Notes</h1>\n' },
    text: 'I built index.html.',
  }),
  sandbox: fakeSandbox(),
  judge: { model: fakeJudge({ score: 0.9 }) },
  analysis: { model: fakeAnalysis({ vote: 'tie' }) },
})
