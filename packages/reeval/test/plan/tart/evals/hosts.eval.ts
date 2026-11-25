import { defineEnvironment, defineEval } from 'reeval'
import { tart } from 'reeval/sandbox'

// Two Macs over SSH, one VM on the mini: at most three VMs at once, whatever --concurrency asks for.
const macs = defineEnvironment('macs', {
  sandbox: tart({
    image: 'ghcr.io/cirruslabs/macos-sequoia-base:15.6',
    hosts: ['mac-studio', { host: 'mac-mini.local', user: 'elliot', vms: 1 }],
  }),
})

export default defineEval({ environment: macs, runs: 4, task: async () => {} })
