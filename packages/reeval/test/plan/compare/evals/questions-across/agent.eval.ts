import { defineEval } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [skilled] },
  questions: [{ question: 'Which agent is clearer?', across: 'agent', diff: true }],
  task: async () => {},
})
