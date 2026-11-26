import { defineEval, metric } from 'reeval'
import { base, skilled } from '../envs.ts'

export default defineEval({
  compare: { control: base, variants: [skilled] },
  questions: [{ question: 'Which handles state more cleanly?', across: 'environment', diff: true }],
  runs: 2,
  target: metric(0.5),
  task: async () => {},
})
