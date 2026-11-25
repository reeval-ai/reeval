import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({ id: 'file' }),
  sandbox: fakeSandbox(),
  profiles: {
    ci: { defaults: { agents: fakeAgent({ id: 'profile' }) } },
  },
})
