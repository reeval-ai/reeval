import { defineEnvironment, defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'

const host = defineEnvironment('host', { sandbox: fakeSandbox() })

// No warning: the fake sandbox.
export default defineEval({ environment: host, task: async () => {} })
