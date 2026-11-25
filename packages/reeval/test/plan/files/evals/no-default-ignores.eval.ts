import { defineEval } from 'reeval'
import { everything } from './env.ts'

export default defineEval({ environment: everything, task: async () => {} })
