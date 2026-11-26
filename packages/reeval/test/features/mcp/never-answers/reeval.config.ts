import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX=docker is the Docker tier (D), the one it lists: it waits out the 60s timeout.
// As the agent: start the environment's stdio server and call its tool.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ mcp: 'stamp/house_stamp' }, { reply: 'stamped' }]] }),
})
