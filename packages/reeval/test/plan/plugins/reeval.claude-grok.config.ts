import { defineConfig } from 'reeval'
import { claudeCode, grokBuild } from 'reeval/agent'

export default defineConfig({
  include: ['evals/namespaced.eval.ts'],
  agents: [claudeCode({ model: 'claude-sonnet-5' }), grokBuild({ model: 'grok-4.6' })],
})
