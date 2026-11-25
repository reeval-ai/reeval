import { defineEval } from 'reeval'
import { fakeSandbox } from 'reeval/sandbox'

export default defineEval({ sandbox: fakeSandbox(), egress: 'allow-all', task: async () => {} })
