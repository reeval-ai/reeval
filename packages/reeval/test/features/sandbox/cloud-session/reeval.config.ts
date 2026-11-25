import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker tier only: cloud() on the fake VM service through REEVAL_VM_URL, whose machines are
// sshd containers laid out like a VM, with the host's Docker. As the agent: who and where the
// shell runs, which node it finds, and its proxy.
export default defineConfig({
  agents: fakeAgent({
    script: [[{ exec: 'id -un; pwd; command -v node; printenv HTTPS_PROXY || echo no-proxy' }]],
  }),
})
