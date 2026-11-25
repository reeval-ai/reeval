import { defineEval } from 'reeval'
import { pinned } from './env.ts'

export default defineEval({ environment: pinned, task: async () => {} })
