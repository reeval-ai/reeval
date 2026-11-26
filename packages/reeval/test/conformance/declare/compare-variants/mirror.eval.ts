import { regression } from 'reeval'
import { evaluate } from 'reeval/legacy'
import { base, skilled, terse } from '../../../plan/compare/evals/envs.ts'

evaluate(
  'control and two variants',
  { compare: { control: base, variants: [skilled, terse] } },
  async () => {},
)
evaluate(
  'every cell gated, with a minimum lift',
  { compare: { control: base, variants: [skilled], minLift: 0.2 }, target: regression(), runs: 2 },
  async () => {},
)
