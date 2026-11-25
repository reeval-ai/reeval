import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

const compare = { control: base, variants: [skilled] }

export default defineEval({ compare, runs: 1, task: async () => {} })
