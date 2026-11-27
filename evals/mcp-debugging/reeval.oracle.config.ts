// Checks the eval itself, with no keys or Docker: the oracle fixes every fixture and must score
// 100%, `--profile canary` skips the failing eval instead and must score under it, and
// `--profile mcp` also calls reeval mcp from the variant (only the `with-mcp` cells: the baseline
// has no server to call).
import { join } from 'node:path'
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

const oracle = `node ${JSON.stringify(join(import.meta.dirname, 'scripts/oracle.mjs'))}`

export default defineConfig({
  include: ['*.eval.ts'],
  agents: fakeAgent({ script: [[{ exec: oracle }]], text: 'Fixed it.' }),
  sandbox: fakeSandbox(),
  profiles: {
    canary: {
      defaults: { agents: fakeAgent({ script: [[{ exec: `${oracle} --cheat` }]] }) },
    },
    mcp: {
      defaults: {
        agents: fakeAgent({
          script: [[{ mcp: 'reeval/failures' }, { exec: oracle }]],
        }),
      },
    },
  },
})
