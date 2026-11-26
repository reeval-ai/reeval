import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// As the agent: start the environment's stdio server and call its tool.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ mcp: 'stamp/house_stamp' }, { reply: 'stamped' }]] }),
})
