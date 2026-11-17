import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'

// Docker tier only: cloud() on the fake VM service, whose sshd containers have a VM's /proc and
// sudo.
export default defineConfig({ harnesses: fakeHarness() })
