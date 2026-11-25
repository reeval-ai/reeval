import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

export const net = defineEnvironment('net', {
  sandbox: docker({ capabilities: ['NET_RAW'] }),
})

export const rooted = defineEnvironment('rooted', {
  sandbox: docker({ root: true }),
})

// The config environment adds a capability; the rooted profile replaces it entirely.
export default defineConfig({
  agents: fakeAgent(),
  environments: net,
  profiles: { rooted: { defaults: { environments: rooted } } },
})
