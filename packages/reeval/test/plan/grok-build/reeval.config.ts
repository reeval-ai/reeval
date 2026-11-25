import { defineConfig } from 'reeval'
import { cursor, grokBuild } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), grokBuild({ model: 'grok-4.6' })],
})
