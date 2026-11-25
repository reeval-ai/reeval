import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox can't enforce a policy, so reeval run would exit 2.
export default defineConfig({ agents: fakeAgent() })
