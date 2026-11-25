import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// No egress: every attempt runs under the default, 'proxy', unless it sets its own.
export default defineConfig({ agents: fakeAgent() })
