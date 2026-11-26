import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  agents: fakeAgent({
    tools: [
      { tool: 'Skill', input: { skill: 'foo' }, output: 'loaded' },
      { tool: 'mcp__docs__search', input: { query: 'retry' }, output: 'hit' },
      { tool: 'Read', input: { path: 'README.md' }, output: '# app' },
    ],
    script: [[{ exec: 'echo built' }, { write: { 'src/client.ts': 'export {}\n' } }]],
  }),
})
