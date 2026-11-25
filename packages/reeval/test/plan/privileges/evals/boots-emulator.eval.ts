import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const kvm = defineEnvironment('kvm', { sandbox: docker({ devices: ['kvm'] }) })

// A host device: a warning.
export default defineEval({ environment: kvm, task: async () => {} })
