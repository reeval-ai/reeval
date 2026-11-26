import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The command prints 318,911 bytes, past the 128K characters trajectory.jsonl keeps of one output.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: "seq 1 30000 | sed 's/^/line-/'; echo END-OF-OUTPUT-77" }]],
  }),
})
