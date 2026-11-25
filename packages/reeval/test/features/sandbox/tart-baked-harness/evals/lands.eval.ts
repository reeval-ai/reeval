import { defineEval, expect } from 'reeval'
import { agentSaw, mac } from './env.ts'

// The bootstrap ran once, in the VM preflight baked, not in this attempt's clone of it.
export default defineEval({
  environment: mac,
  task: async (c) => {
    const [where, vm] = agentSaw(await c.send('where was I installed'))
    expect(where).toBe('baked')
    expect(vm).toMatch(/^reeval-sandbox-fake-[0-9a-f]{8}-.*-bake-[0-9a-z]{8,}-[0-9a-f]{4}$/)
  },
})
