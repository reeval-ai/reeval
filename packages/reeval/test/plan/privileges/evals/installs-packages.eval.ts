import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const pkgs = defineEnvironment('pkgs', { sandbox: docker({ root: true }) })

// Root on the eval's environment: a warning.
export default defineEval({ environment: pkgs, task: async () => {} })
