import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent(),
  sandbox: fakeSandbox(),
  cloud: true,
  profiles: { here: { cloud: false }, there: { defaults: { runs: 2 } } },
})
