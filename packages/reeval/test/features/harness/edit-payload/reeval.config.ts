import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The file is 200,001 characters, past the 128K characters transcript.jsonl keeps of one input.
export default defineConfig({
  harnesses: fakeHarness({ files: { 'big.txt': `${'x'.repeat(200_000)}\n` } }),
})
