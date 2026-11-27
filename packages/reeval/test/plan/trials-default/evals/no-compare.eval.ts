import { defineEnvironment, defineEval } from 'reeval'

const base = defineEnvironment('base', { env: { MODE: 'base' } })

export default defineEval({ environment: base, task: async () => {} })
