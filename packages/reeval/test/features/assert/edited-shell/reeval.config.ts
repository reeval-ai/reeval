import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// A heredoc write, as Claude Code makes with Bash: no file-edit event, only the workspace diff.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: "cat <<'EOF' > notes.txt\nhello\nEOF" }]] }),
})
