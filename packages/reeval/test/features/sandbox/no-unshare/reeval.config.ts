import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker and Podman only: the fake sandbox runs on the host, with the host's seccomp.
export default defineConfig({
  target: regression(),
  // As the agent: make a user and a network namespace of its own.
  agents: fakeAgent({
    script: [[{ exec: 'unshare --user --net true 2>&1; echo "exit=$?"' }]],
  }),
})
