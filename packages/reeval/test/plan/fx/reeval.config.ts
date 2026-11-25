import { defineConfig } from 'reeval'
import { cursor, fx } from 'reeval/agent'
import { direct, vercel } from 'reeval/gateway'

export default defineConfig({
  agents: [cursor({ model: 'composer-2.5' }), fx({ model: 'anthropic/claude-sonnet-5' })],
  // fx's own OpenAI id on its key; a gateway id only through Vercel.
  gateway: [direct(), vercel()],
})
