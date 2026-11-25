import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { tart } from 'reeval/sandbox'

// Tart keeps the VM's own network, so its evals run under allow-all.
const mac = defineEnvironment('mac', {
  sandbox: tart({ image: 'ghcr.io/cirruslabs/macos-sequoia-base:latest' }),
})

export default defineConfig({ agents: fakeAgent(), environments: mac, egress: 'allow-all' })
