import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the environments set docker() themselves. The fake agent takes Cursor's layout,
// so reeval unpacks the plugin's subagent into the workspace's .cursor/agents.
export default defineConfig({
  agents: fakeAgent({ layout: 'cursor' }),
})
