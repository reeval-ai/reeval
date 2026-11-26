import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ADDRESSES, bridged, within } from './env.ts'

// Must fail: rootless Podman's default network, slirp4netns, would put the sandbox at 10.0.2.100.
export default defineEval({
  environment: bridged,
  graders: [
    observed<string[]>('addresses', (addresses) => within(addresses, ['10.0.2.0/24']).length === 1),
  ],
  task: async (c) => {
    c.observe('addresses', (await c.exec(ADDRESSES)).stdout.trim().split('\n'))
  },
})
