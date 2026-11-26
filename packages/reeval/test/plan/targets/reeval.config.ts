import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })],
  profiles: { blocking: { defaults: { target: regression() } } },
})
