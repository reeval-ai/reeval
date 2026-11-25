import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// Docker tier only: docker() with a plugin build, planned for a cloud run, so the build runs in
// a layer of the image each attempt's VM prepares, from the fake VM service, whose VMs have the
// host's Docker. The environments set docker() themselves.
export default defineConfig({
  agents: fakeAgent({}),
})
