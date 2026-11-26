import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Podman only: which network a rootless container is on is Podman's question.
export default defineConfig({
  target: regression(),
  agents: fakeAgent(),
})
