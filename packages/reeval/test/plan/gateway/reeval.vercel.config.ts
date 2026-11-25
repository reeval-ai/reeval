import { defineConfig } from 'reeval'
import { claudeCode, codex, cursor, goose, grokBuild, pi } from 'reeval/agent'
import { direct, vercel } from 'reeval/gateway'

export default defineConfig({
  agents: [
    claudeCode({ model: 'claude-sonnet-5-5' }),
    codex({ model: 'gpt-5.4-mini' }),
    cursor({ model: 'composer-2.5' }),
    goose({ model: 'google/gemini-3.8-flash' }),
    pi({ model: 'google/gemini-3.8-flash' }),
    pi({ model: 'anthropic/claude-haiku-4.5' }),
    grokBuild({ model: 'grok-4.6' }),
  ],
  gateway: [vercel()],
  profiles: {
    'codex-pin': {
      gateway: [direct(), vercel()],
      defaults: { agents: codex({ model: 'gpt-5.4-mini', gateway: 'vercel' }) },
    },
  },
})
