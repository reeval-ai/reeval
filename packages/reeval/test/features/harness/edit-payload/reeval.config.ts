import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The file is 200,001 characters, past the 128K characters trajectory.jsonl keeps of one input.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ files: { 'big.txt': `${'x'.repeat(200_000)}\n` } }),
})
