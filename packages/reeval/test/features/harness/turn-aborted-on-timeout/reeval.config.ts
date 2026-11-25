import { defineConfig } from 'reeval'
import { cursor, fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// REEVAL_FIXTURE_HARNESS=cursor runs it on real Cursor (C), which needs CURSOR_API_KEY.
export default defineConfig({
  agents:
    process.env.REEVAL_FIXTURE_HARNESS === 'cursor'
      ? cursor({ model: process.env.REEVAL_REAL_MODEL ?? 'composer-2.5' })
      : fakeAgent({ delayMs: 10_000 }),
})
