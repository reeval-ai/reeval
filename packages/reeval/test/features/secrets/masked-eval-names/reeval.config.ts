import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Fake tier only: the eval's name is masked on the host, whatever the sandbox.
export default defineConfig({ agents: fakeAgent() })
