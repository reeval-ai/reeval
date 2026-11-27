import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { baseline: base, variants: [skilled] }

export default defineEval({ compare, trials: 3, task: async () => {} })
