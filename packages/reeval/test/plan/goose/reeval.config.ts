import { defineConfig } from 'reeval'
import { cursor, goose } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), goose({ model: 'google/gemini-3.8-flash' })],
})
