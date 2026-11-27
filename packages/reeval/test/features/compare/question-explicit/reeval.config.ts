import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeAnalysis } from 'reeval/judge'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The question's vote reports what it was shown as its reason, for the record check.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ files: { 'out.txt': 'hi\n' }, text: 'REPLY-MARK' }),
  // One trial a cell, where a compare would otherwise run 4 a side.
  trials: 1,
  analysis: {
    model: fakeAnalysis({
      vote: (p) => ({
        winner: 'tie',
        reason: JSON.stringify({
          keys: Object.keys(p.a).sort(),
          task: p.prompt.includes('<task>'),
          reply: p.prompt.includes('REPLY-MARK'),
        }),
      }),
    }),
  },
})
