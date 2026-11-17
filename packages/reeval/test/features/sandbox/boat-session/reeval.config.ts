import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'

// Docker tier only: docker() on boat(), the fake Boat API, whose sandboxes are sshd containers laid out like a
// Boat VM. As the agent: who and where the shell runs, which node it finds, and its proxy.
export default defineConfig({
  harnesses: fakeHarness({
    script: [[{ exec: 'id -un; pwd; command -v node; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
  provider: boat(),
})
