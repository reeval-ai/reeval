import { defineConfig } from 'reeval'
import { codex, cursor } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), codex({ model: 'gpt-5.4-mini' })],
})
