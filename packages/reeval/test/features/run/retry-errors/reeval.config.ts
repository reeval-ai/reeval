import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { retry } from './evals/env.ts'

// REEVAL_FIXTURE_OUTAGE stands in for an outage before the first turn: the first run's attempts
// end in an infra error, and `--retry-errors` runs them again without it.
export default defineConfig({
  target: regression(),
  agents: fakeAgent(
    process.env.REEVAL_FIXTURE_OUTAGE ? { failWith: 'fixture outage before the first turn' } : {},
  ),
  environments: retry,
})
