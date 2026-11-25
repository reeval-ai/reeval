import { defineConfig } from 'reeval'
import { cursor, pi } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), pi({ model: 'google/gemini-3.8-flash' })],
})
