import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })],
  profiles: { vite: { limit: { traits: { stack: 'vite' } } } },
})
