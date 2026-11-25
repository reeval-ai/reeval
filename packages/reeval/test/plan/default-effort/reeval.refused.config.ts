import { defineConfig } from 'reeval'
import { cursor } from 'reeval/agent'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5', effort: 'medium', params: { fast: 'false' } })],
})
