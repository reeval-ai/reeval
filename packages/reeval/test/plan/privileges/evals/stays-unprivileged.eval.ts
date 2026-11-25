import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const plain = defineEnvironment('plain', { sandbox: docker() })

// No warning: a default docker() environment.
export default defineEval({ environment: plain, task: async () => {} })
