import { defineEval, expect } from 'reeval'
import { ADDRESSES, bridged, bridgeSubnets, within } from './env.ts'

// podman() puts the sandbox on the `podman` bridge, the one network the other policies can detach
// it from: its address is in that network's subnet.
export default defineEval({
  environment: bridged,
  task: async (c) => {
    const addresses = (await c.exec(ADDRESSES)).stdout.trim().split('\n')
    expect(within(addresses, bridgeSubnets())).toHaveLength(1)
  },
})
