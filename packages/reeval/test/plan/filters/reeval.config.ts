import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: [fakeAgent({ id: 'left' }), fakeAgent({ id: 'right' })],
})
