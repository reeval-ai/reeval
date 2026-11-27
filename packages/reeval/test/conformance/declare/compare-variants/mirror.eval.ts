import { regression } from 'reeval'
import { evaluate } from 'reeval/legacy'
import { base, skilled, terse } from '../../../plan/compare/evals/envs.ts'

evaluate(
  'baseline and two variants',
  { compare: { baseline: base, variants: [skilled, terse] } },
  async () => {},
)
evaluate(
  'every cell gated, with a minimum lift',
  { compare: { baseline: base, variants: [skilled], minLift: 0.2 }, target: regression(), trials: 2 },
  async () => {},
)
