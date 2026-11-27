import { defineEval } from 'reeval'
import { base, terse } from '../envs.ts'

export default defineEval({
  compare: { baseline: base, variants: [terse] },
  questions: [{ question: 'Which handles state more cleanly?', across: 'environment', diff: true }],
  task: async () => {},
})
