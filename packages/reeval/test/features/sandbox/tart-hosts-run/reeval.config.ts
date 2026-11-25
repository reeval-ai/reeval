import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// tart({ hosts }) on fake Macs a fake ssh reaches. As the agent, through the VM's harness session:
// where it runs, and Cursor's key, which the gateway on this machine brokers through the tunnel.
export default defineConfig({
  agents: fakeAgent({
    layout: 'cursor',
    brokers: true,
    script: [[{ exec: 'pwd; printf "%s\\n" "$CURSOR_API_KEY"' }]],
  }),
})
