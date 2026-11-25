import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox runs on the host as whoever runs reeval.
export default defineConfig({
  // As the agent: its uid and effective capabilities.
  agents: fakeAgent({
    script: [[{ exec: `echo "$(id -u) $(awk '/^CapEff/ {print $2}' /proc/self/status)"` }]],
  }),
})
