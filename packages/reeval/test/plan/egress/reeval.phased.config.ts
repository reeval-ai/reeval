import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent(),
  egress: { setup: 'allow-all', agent: { allow: ['config.example.com'] } },
  profiles: { 'agent-locked': { defaults: { egress: { agent: 'deny-all' } } } },
})
