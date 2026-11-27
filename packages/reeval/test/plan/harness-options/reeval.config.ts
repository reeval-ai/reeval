import { defineConfig } from 'reeval'
import { claudeCode, codex, goose, opencode, pi, withOptions } from 'reeval/agent'

export default defineConfig({
  agents: [
    ...withOptions(
      [
        claudeCode({ model: 'claude-sonnet-5' }),
        opencode({ model: 'anthropic/claude-sonnet-5' }),
        pi({ model: 'anthropic/claude-sonnet-5' }),
      ],
      { tools: ['read', 'bash'], commands: ['npm test'] },
    ),
    codex({ model: 'gpt-5.6-luna', systemPrompt: 'You are a careful reviewer.' }),
    goose({ model: 'google/gemini-3.8-flash', instructions: 'Answer in one line.' }),
  ],
})
