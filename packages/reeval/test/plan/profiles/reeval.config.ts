import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({ id: 'a' }),
  sandbox: fakeSandbox(),
  defaultProfile: { ci: 'pr' },
  profiles: {
    pr: {
      limit: { runs: 1, compare: false, agents: ['a'] },
      budget: { attempts: 5 },
      tags: ['!nightly-only'],
    },
    nightly: {
      defaults: { runs: 3, agents: [fakeAgent({ id: 'a' }), fakeAgent({ id: 'b' })] },
    },
  },
})
