import { defineEval } from 'reeval'
import { goose } from 'reeval/agent'

export default defineEval({
  agents: [
    goose({ model: 'anthropic/claude-haiku-4-5' }),
    goose({ model: 'openai/gpt-5.4-mini' }),
    goose({ model: 'xai/grok-4.6' }),
    goose({ model: 'google/gemini-3.8-flash', id: 'goose:google' }),
  ],
  egress: 'deny-all',
  task: async () => {},
})
