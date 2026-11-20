import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'

// Docker only: the fake sandbox runs on the host, and rootless Podman can't map the device's group.
export default defineConfig({ harnesses: fakeHarness() })
