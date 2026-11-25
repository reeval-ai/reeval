import { defineEval } from 'reeval'
import { pi } from 'reeval/agent'

export default defineEval({
  agents: [
    pi({ model: 'anthropic/claude-haiku-4-5' }),
    pi({ model: 'openai/gpt-5.4-mini' }),
    pi({ model: 'xai/grok-4.6' }),
    pi({ model: 'mistral/devstral-2' }),
    pi({ model: 'huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct' }),
    pi({ model: 'google/gemini-3.8-flash', id: 'pi:google' }),
  ],
  egress: 'deny-all',
  task: async () => {},
})
