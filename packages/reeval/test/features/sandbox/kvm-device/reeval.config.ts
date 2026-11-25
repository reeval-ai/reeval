import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker only: the fake sandbox runs on the host, and rootless Podman can't map the device's group.
export default defineConfig({ agents: fakeAgent() })
