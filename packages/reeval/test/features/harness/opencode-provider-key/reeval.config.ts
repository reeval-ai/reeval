import { defineConfig } from 'reeval'
import { opencode } from 'reeval/agent'

// Real OpenCode only (O), on Anthropic with ANTHROPIC_API_KEY: the model's provider picks the key,
// and only that key, as a placeholder, reaches the sandbox.
export default defineConfig({
  agents: opencode({ model: process.env.REEVAL_REAL_MODEL ?? 'anthropic/claude-sonnet-5-5' }),
})
