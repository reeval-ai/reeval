import { defineConfig } from 'reeval'
import { claudeCode } from 'reeval/agent'

export default defineConfig({
  include: ['*.eval.ts'],
  agents: claudeCode({ model: 'claude-sonnet-5' }),
  timeout: '15m',
})
