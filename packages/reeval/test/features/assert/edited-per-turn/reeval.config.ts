import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// Turn 1 writes notes.txt from the shell; turn 2 only reads it, though the diff still shows it.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: "cat <<'EOF' > notes.txt\nhello\nEOF" }], [{ exec: 'cat notes.txt' }]],
  }),
})
