import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { tokens } from 'reeval/graders'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    usage: { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, reasoning: null },
    costUsd: 0.01,
    tools: [
      { tool: 'bash', input: { command: 'ls' }, output: '' },
      { tool: 'bash', input: { command: 'pwd' }, output: '/' },
    ],
  }),
  // Every eval grades with these, under its own.
  graders: [tokens(), { builtin: 'turns', weight: 0 }],
})
