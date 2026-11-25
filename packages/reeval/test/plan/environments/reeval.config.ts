import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

/** The config default, which a compare.control replaces. */
export const node22 = defineEnvironment('node22', {
  sandbox: docker({ from: 'node:22-bookworm' }),
})

export default defineConfig({
  agents: fakeAgent(),
  sandbox: docker({ from: 'node:24-bookworm' }),
  environments: node22,
})
