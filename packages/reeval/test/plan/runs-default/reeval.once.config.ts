import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// A config-level runs is explicit, so a compare under it runs once too.
export default defineConfig({ agents: fakeAgent({ id: 'a' }), runs: 1 })
