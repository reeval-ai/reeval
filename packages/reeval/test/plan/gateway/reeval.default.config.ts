import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { direct } from 'reeval/gateway'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({ id: 'a' }),
  sandbox: fakeSandbox(),
  profiles: { listed: { gateway: [direct()] } },
})
