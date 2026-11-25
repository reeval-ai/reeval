import { defineEval } from 'reeval'
import { whole } from './env.ts'

export default defineEval({ environment: whole, task: async () => {} })
