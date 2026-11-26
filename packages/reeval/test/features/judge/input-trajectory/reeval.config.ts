import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    reasoning: 'thinking it over',
    tools: [{ tool: 'shell', input: { command: 'npm test' }, output: '14 passing' }],
    files: { 'src/app.ts': 'export const app = () => "hello"\n' },
  }),
  judge: { model: fakeJudge({ score: 1 }) },
})
