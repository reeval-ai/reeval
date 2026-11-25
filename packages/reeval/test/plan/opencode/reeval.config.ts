import { defineConfig } from 'reeval'
import { cursor, opencode } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), opencode({ model: 'google/gemini-3.8-flash' })],
})
