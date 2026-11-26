import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D). The
// agent runs a command and writes a file, then sits out 15s even when it's told to stop.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    delayMs: 15_000,
    ignoreAbort: true,
    script: [[{ exec: 'echo step-1' }, { write: { 'notes.txt': 'step 1\n' } }]],
    usage: { input: 120, output: 30, cacheRead: 400, cacheWrite: 0, reasoning: 10 },
  }),
})
