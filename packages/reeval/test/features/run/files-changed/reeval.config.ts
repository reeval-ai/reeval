import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { notes } from './evals/env.ts'

// As the agent: write one file from the shell, never with an edit tool.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: "printf 'from the shell\\n' > note.txt" }]] }),
  environments: notes,
})
