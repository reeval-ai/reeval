import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  // As the agent: start the plugin's stdio server and call its tool.
  agents: fakeAgent({ script: [[{ mcp: 'review:docs/house_stamp' }, { reply: 'stamped' }]] }),
})
