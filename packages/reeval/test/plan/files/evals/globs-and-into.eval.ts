import { defineEval } from 'reeval'
import { picked } from './env.ts'

export default defineEval({ environment: picked, task: async () => {} })
