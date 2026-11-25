import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

export default defineConfig({
  include: [
    'evals/every-part-2.eval.ts',
    'evals/only-skills-and-mcp.eval.ts',
    'evals/child-replaces-the-review-plugin.eval.ts',
    'evals/remote-plugins*.eval.ts',
    'evals/npx-*.eval.ts',
    'evals/marketplace.eval.ts',
  ],
  agents: fakeAgent(),
  sandbox: docker({ from: 'node:22-bookworm' }),
})
