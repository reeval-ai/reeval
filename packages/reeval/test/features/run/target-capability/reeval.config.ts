import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({}),
  sandbox: fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) }),
  trials: 2,
})
