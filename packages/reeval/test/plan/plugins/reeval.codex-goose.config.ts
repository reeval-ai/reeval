import { defineConfig } from 'reeval'
import { codex, goose } from 'reeval/agent'

export default defineConfig({
  include: ['evals/skills-and-mcp.eval.ts'],
  agents: [codex({ model: 'gpt-5.6-luna' }), goose({ model: 'google/gemini-3.8-flash' })],
})
