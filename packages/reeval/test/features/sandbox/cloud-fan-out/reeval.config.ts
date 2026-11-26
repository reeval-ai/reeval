import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { docker } from 'reeval/sandbox'

// Docker tier only: a docker() sandbox planned for a cloud run, so each attempt runs the same
// container on a VM of its own from the fake VM service, whose VMs have the host's Docker. As
// the agent: who runs the shell.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({ script: [[{ exec: 'id -un' }]] }),
  sandbox: docker({ root: true }),
  egress: 'allow-all',
})
