import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// The fake agent reports no usage, so a tokens limit can't be checked either way.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ tools: [{ tool: 'bash', input: { command: 'ls' }, output: '' }] }),
})
