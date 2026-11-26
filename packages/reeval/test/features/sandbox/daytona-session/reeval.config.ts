import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { daytona } from 'reeval/provider/daytona'

// Docker tier only: docker() on daytona(), the fake Daytona API, whose sandboxes are sshd containers that a
// token logs in to with no key, as Daytona's SSH gateway takes one. As the agent: who and where the
// shell runs, which node and npm it finds, and its proxy.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [
      [
        {
          exec: 'id -un; pwd; command -v node; command -v npm; printenv HTTPS_PROXY || echo no-proxy',
        },
      ],
    ],
  }),
  provider: daytona(),
})
