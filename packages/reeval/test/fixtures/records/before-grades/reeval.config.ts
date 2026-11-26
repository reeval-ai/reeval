import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

// A record corpus entry (the corpus recipe), recorded by reeval 0.31.0 at 255c9f9b.
// Don't re-record it: test/corpus.test.ts reads it to prove this shape still loads.
export default defineConfig({
  agents: fakeAgent(),
  environments: defineEnvironment('fake', { sandbox: fakeSandbox() }),
  analysis: {
    model: fakeAnalysis({ output: () => ({ tldr: 'corpus', whatHappened: [], results: [], why: [], anomalies: [], actions: [], confidence: { overall: 'low', why: 'corpus' } }) }),
  },
})
