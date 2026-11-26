import { regression } from 'reeval'
import { evaluate } from 'reeval/legacy'
import { base, skilled } from '../../../plan/compare/evals/envs.ts'

evaluate(
  'pooled',
  {
    cases: [{ key: 'ada' }, { key: 'grace' }, { key: 'linus' }],
    compare: { control: base, variants: [skilled], minLift: 0.2 },
    target: regression(),
  },
  async () => {},
)
evaluate(
  'keyed',
  {
    cases: [
      { key: 'ada', who: 'Ada Lovelace' },
      { key: 'grace', who: 'Grace Hopper' },
    ],
    compare: { control: base, variants: [skilled] },
  },
  async () => {},
)
evaluate('one case is not pooled', { cases: [{ key: 'only' }] }, async () => {})
