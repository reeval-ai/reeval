import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The first turn fails as an outage would; the second as Anthropic out of credit would.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [{ error: '503 Service Unavailable: overloaded' }],
      [{ error: 'Your credit balance is too low to access the Anthropic API.' }],
    ],
  }),
})
