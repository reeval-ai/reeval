import { defineConfig } from 'reeval'
import { fx, opencode, pi } from 'reeval/agent'

export default defineConfig({
  include: [
    'evals/opencode-loads-the-plugin.eval.ts',
    'evals/pi-loads-the-plugin.eval.ts',
    'evals/fx-loads-the-plugin.eval.ts',
  ],
  agents: [
    opencode({ model: 'google/gemini-3.8-flash' }),
    pi({ model: 'google/gemini-3.8-flash' }),
    fx({ model: 'gpt-5.5' }),
  ],
})
