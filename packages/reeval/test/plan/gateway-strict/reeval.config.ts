import { defineConfig } from 'reeval'
import { claudeCode, codex } from 'reeval/agent'
import { direct, vercel } from 'reeval/gateway'

// Strict routing: direct() off, so every cell runs on Vercel AI Gateway or the plan refuses it.
export default defineConfig({
  agents: [claudeCode({ model: 'claude-sonnet-5-5' }), codex({ model: 'gpt-5.4-mini' })],
  gateway: [vercel(), direct({ enabled: false })],
})
