import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker and Podman only: the fake sandbox runs on the host, with the host's umask.
export default defineConfig({
  target: regression(),
  // As the agent: a directory and a file from a command, and a file from its write tool.
  agents: fakeAgent({
    script: [
      [{ exec: 'mkdir -p made && touch made/by-agent' }, { write: { 'notes/today.md': 'hi\n' } }],
    ],
  }),
})
