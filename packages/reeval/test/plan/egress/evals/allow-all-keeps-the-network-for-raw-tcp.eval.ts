import { defineEnvironment, defineEval } from 'reeval'

const database = defineEnvironment('database', { egress: 'allow-all' })

export default defineEval({ environment: database, task: async () => {} })
