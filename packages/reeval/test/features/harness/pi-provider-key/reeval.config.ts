import { defineConfig } from 'reeval'
import { pi } from 'reeval/agent'

// Real pi only (O), on Anthropic with ANTHROPIC_API_KEY: the model's provider picks the key,
// and only that key, as a placeholder, reaches the sandbox.
export default defineConfig({
  agents: pi({ model: process.env.REEVAL_REAL_MODEL ?? 'anthropic/claude-haiku-4-5' }),
})
