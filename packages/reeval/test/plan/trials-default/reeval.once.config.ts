import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// A config-level trials is explicit, so a compare under it runs once too.
export default defineConfig({ agents: fakeAgent({ id: 'a' }), trials: 1 })
