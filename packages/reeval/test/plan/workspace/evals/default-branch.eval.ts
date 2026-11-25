import { defineEval } from 'reeval'
import { moving } from './env.ts'

export default defineEval({ environment: moving, task: async () => {} })
