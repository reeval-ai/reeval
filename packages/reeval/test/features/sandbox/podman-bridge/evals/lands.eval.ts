import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { ADDRESSES, bridged, bridgeSubnets, within } from './env.ts'

// podman() puts the sandbox on the `podman` bridge, the one network the other policies can detach
// it from: its address is in that network's subnet.
export default defineEval({
  environment: bridged,
  graders: [
    observed<string[]>('addresses', (addresses) => within(addresses, bridgeSubnets()).length === 1),
  ],
  task: async (c) => {
    c.observe('addresses', (await c.exec(ADDRESSES)).stdout.trim().split('\n'))
  },
})
